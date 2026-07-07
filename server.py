"""FastAPI server for WhatsApp chatbot."""
from fastapi import FastAPI, Form, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from twilio.twiml.messaging_response import MessagingResponse
from twilio.request_validator import RequestValidator
from agent import create_initial_state, chat
from database import get_trader_by_whatsapp
from storage import process_images
import asyncio
import uvicorn
import logging
import os

# Configure logging
logging.basicConfig(
    filename='server.log',
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    force=True
)

app = FastAPI()

# CORS Configuration for production
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [
    frontend_url,
    "https://sharpshop.app",
    "https://www.sharpshop.app",
    "https://sharpshop-frontend-011b1462cb27.herokuapp.com",
    "http://localhost:3000",
    "http://localhost:8001",
    "http://0.0.0.0:8001"
]

# Also allow localhost and private-LAN origins on any port so a phone/laptop on
# the same network can reach the dev backend (e.g. http://192.168.1.10:5000).
LOCAL_ORIGIN_REGEX = (
    r"https?://("
    r"localhost|127\.0\.0\.1"
    r"|10(?:\.\d{1,3}){3}"
    r"|192\.168(?:\.\d{1,3}){2}"
    r"|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}"
    r")(?::\d+)?"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=LOCAL_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store
user_sessions = {}

# Twilio webhook authentication — without this anyone who finds the URL can
# spoof a seller's number and manage their inventory.
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
_twilio_validator = RequestValidator(TWILIO_AUTH_TOKEN) if TWILIO_AUTH_TOKEN else None

def twilio_request_is_valid(request: Request, form_data) -> bool:
    if _twilio_validator is None:
        logging.warning("TWILIO_AUTH_TOKEN not set — skipping webhook signature validation")
        return True
    signature = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)
    # Heroku terminates TLS at the router; rebuild the public https URL Twilio signed
    if request.headers.get("x-forwarded-proto") == "https" and url.startswith("http://"):
        url = "https://" + url[len("http://"):]
    return _twilio_validator.validate(url, dict(form_data), signature)

@app.post("/whatsapp")
async def whatsapp_webhook(request: Request):
    """Handle incoming WhatsApp messages."""
    form_data = await request.form()

    if not twilio_request_is_valid(request, form_data):
        logging.warning("Rejected /whatsapp request with invalid Twilio signature")
        return Response(content="Invalid signature", status_code=403)

    incoming_msg = form_data.get('Body', '').strip()
    sender_id = form_data.get('From', '')

    # Check for media (images)
    try:
        num_media = int(form_data.get('NumMedia', 0))
    except (TypeError, ValueError):
        num_media = 0
    twilio_image_urls = []
    if num_media > 0:
        for i in range(num_media):
            media_url = form_data.get(f'MediaUrl{i}')
            if media_url:
                twilio_image_urls.append(media_url)

    logging.info(f"Received message from {sender_id}: {incoming_msg}")

    # Extract WhatsApp number without 'whatsapp:' prefix
    whatsapp_number = sender_id.replace('whatsapp:', '')

    # Check if this is a registered seller (threadpool: sync DB call must not block the event loop)
    trader = await run_in_threadpool(get_trader_by_whatsapp, whatsapp_number)
    
    if trader is None:
        # Not a registered seller - send rejection message
        logging.warning(f"❌ Unregistered WhatsApp number attempted to upload: {whatsapp_number}")
        resp = MessagingResponse()
        resp.message("⚠️ Sorry, this WhatsApp number is not registered as a seller on SharpShop.\n\nTo upload products, please register as a seller at https://sharpshop.app first using this same WhatsApp number.")
        return Response(content=str(resp), media_type="application/xml")
    
    # Process images - download from Twilio and upload to Supabase
    permanent_image_urls = []
    if twilio_image_urls:
        logging.info(f"Processing {len(twilio_image_urls)} images...")
        permanent_image_urls = await run_in_threadpool(process_images, twilio_image_urls)
        logging.info(f"Uploaded {len(permanent_image_urls)} images to Supabase")

    # Get or create user state (pass the trader we already fetched — avoids duplicate lookups)
    if sender_id not in user_sessions:
        user_sessions[sender_id] = create_initial_state(whatsapp_number, trader["business_name"], trader=trader)

    state = user_sessions[sender_id]

    # Add image URL to state if provided
    image_url = permanent_image_urls[0] if permanent_image_urls else None

    # Process message through agent (threadpool: LLM + DB calls are sync)
    try:
        new_state = await run_in_threadpool(chat, state, incoming_msg, image_url)
        user_sessions[sender_id] = new_state

        # Get the last assistant message
        response_text = "Sorry, I didn't understand that."
        for msg in reversed(new_state["messages"]):
            if msg["role"] == "assistant":
                response_text = msg["content"]
                break
    except Exception:
        logging.exception("Error processing message")
        response_text = "Sorry, I encountered an error processing your request."

    # Send response back to Twilio
    resp = MessagingResponse()
    resp.message(response_text)
    
    return Response(content=str(resp), media_type="application/xml")


# --- Customer Agent API ---
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import Depends
from customer_sessions import create_session, get_session, update_session, cleanup_expired_sessions
from customer_agent import handle_customer_chat
from customer_tools import get_shop_info
from customer_config import CLEANUP_INTERVAL, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_PER_HOUR
from rate_limit import RateLimiter

# Per-IP limiter for the customer-facing endpoints (LLM/token cost protection)
customer_rate_limiter = RateLimiter(RATE_LIMIT_PER_MINUTE, RATE_LIMIT_PER_HOUR)

@app.on_event("startup")
async def start_session_cleanup():
    """Periodically evict expired customer sessions (they otherwise only get
    cleaned lazily on access and can leak until restart)."""
    async def _loop():
        while True:
            await asyncio.sleep(CLEANUP_INTERVAL)
            try:
                removed = cleanup_expired_sessions()
                if removed:
                    logging.info(f"Cleaned up {removed} expired customer sessions")
            except Exception:
                logging.exception("Session cleanup failed")
    asyncio.create_task(_loop())

class CustomerChatRequest(BaseModel):
    trader_id: str
    message: str
    session_id: Optional[str] = None

class CustomerChatResponse(BaseModel):
    session_id: str
    reply: str
    products: List[dict] = []
    timestamp: str

class NewSessionRequest(BaseModel):
    trader_id: str

class NewSessionResponse(BaseModel):
    session_id: str
    trader_name: str
    created_at: str

@app.post("/api/chat/customer", response_model=CustomerChatResponse)
async def customer_chat(request: CustomerChatRequest, _rl: None = Depends(customer_rate_limiter)):
    """Handle customer chat messages via web interface."""
    
    # 1. Get or create session
    session = None
    if request.session_id:
        session = get_session(request.session_id)

    if not session:
        # Check if trader exists
        shop_info = await run_in_threadpool(get_shop_info, request.trader_id)
        if not shop_info:
             raise HTTPException(status_code=404, detail="Shop not found")

        session = create_session(request.trader_id, shop_info["business_name"], shop_info["whatsapp_number"])

    # 2. Process message
    # Run agent in threadpool to avoid blocking event loop
    new_state = await run_in_threadpool(handle_customer_chat, session["state"], request.message)
    
    # 3. Update session
    update_session(session["session_id"], new_state)
    
    # 4. Extract reply
    assistant_msg = next((m["content"] for m in reversed(new_state["messages"]) if m["role"] == "assistant"), "No response generated")
    
    # Extract products from tool results
    products = []
    tool_result = new_state["context"].get("tool_result")
    if isinstance(tool_result, dict):
        if "results" in tool_result:
             products = tool_result["results"][:5] # Limit to 5
        elif "available" in tool_result:
             pass
    elif isinstance(tool_result, list):
        products = tool_result[:5]
        
    return CustomerChatResponse(
        session_id=session["session_id"],
        reply=assistant_msg,
        products=products,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

@app.post("/api/chat/customer/session/new", response_model=NewSessionResponse)
async def create_new_customer_session(request: NewSessionRequest, _rl: None = Depends(customer_rate_limiter)):
    """Explicitly create a new session."""
    shop_info = await run_in_threadpool(get_shop_info, request.trader_id)
    if not shop_info:
        raise HTTPException(status_code=404, detail="Shop not found")

    session = create_session(request.trader_id, shop_info["business_name"], shop_info["whatsapp_number"])
    
    return NewSessionResponse(
        session_id=session["session_id"],
        trader_name=shop_info["business_name"],
        created_at=datetime.now(timezone.utc).isoformat()
    )

@app.delete("/api/chat/customer/session/{session_id}")
async def end_customer_session(session_id: str):
    """Cleanup session on close."""
    from customer_sessions import sessions
    if session_id in sessions:
        del sessions[session_id]
    return Response(status_code=204)

@app.get("/api/chat/customer/session/{session_id}/history")
async def get_session_history_endpoint(session_id: str):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return {
        "session_id": session_id,
        "messages": session["state"]["messages"]
    }

@app.get("/api/shop/{trader_id}/preview")
async def get_shop_preview(trader_id: str):
    """Get aggregated shop info and products for preview."""
    
    # Run DB calls in threadpool
    from customer_tools import get_shop_products
    
    shop_info = await run_in_threadpool(get_shop_info, trader_id)
    if not shop_info:
        raise HTTPException(status_code=404, detail="Shop not found")
        
    products = await run_in_threadpool(get_shop_products, trader_id)
    
    return {
        "shop": shop_info,
        "products": products
    }

# --- Direct Checkout API ---
class CheckoutRequest(BaseModel):
    trader_id: str
    product_id: str
    fulfillment_type: str = "delivery"
    customer_email: str = "customer@sharpshop.app"
    customer_phone: str = "08000000000"
    customer_name: str = "SharpShop Customer"
    delivery_address: str = ""

class CheckoutResponse(BaseModel):
    order_id: str
    tx_ref: str
    amount: float
    currency: str
    public_key: str
    product_name: str
    customer_email: str
    customer_phone: str
    customer_name: str
    redirect_url: str

@app.post("/api/checkout", response_model=CheckoutResponse)
async def create_checkout(request: CheckoutRequest, _rl: None = Depends(customer_rate_limiter)):
    """Create an order and return Flutterwave inline checkout config."""
    from customer_tools import create_order, get_product_details
    from customer_config import FLUTTERWAVE_PUBLIC_KEY
    
    # Get product details for amount
    product = await run_in_threadpool(get_product_details, request.trader_id, request.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.get("stock_quantity", 0) <= 0:
        detail = "All slots are taken" if product.get("is_preorder") else "Product is out of stock"
        raise HTTPException(status_code=409, detail=detail)
    if product.get("is_preorder"):
        from customer_tools import deadline_passed
        if deadline_passed(product.get("order_deadline")):
            raise HTTPException(status_code=409, detail="Orders for this drop have closed")

    # Capture the buyer's contact + delivery details on the order so the seller
    # can actually fulfil it. These come prefilled from the buyer's account.
    delivery_details = {
        "name": request.customer_name,
        "phone": request.customer_phone,
        "email": request.customer_email,
        "address": request.delivery_address,
    }

    # Create order in database (price already fetched above)
    order = await run_in_threadpool(
        create_order,
        request.trader_id,
        request.product_id,
        request.fulfillment_type,
        delivery_details,
        product["price"],
    )
    
    tx_ref = f"sharpshop_{order['id']}"
    
    return CheckoutResponse(
        order_id=str(order["id"]),
        tx_ref=tx_ref,
        amount=float(product["price"]),
        currency="NGN",
        public_key=FLUTTERWAVE_PUBLIC_KEY,
        product_name=product["name"],
        customer_email=request.customer_email,
        customer_phone=request.customer_phone,
        customer_name=request.customer_name,
        redirect_url=f"https://sharpshop.app/pay/callback?order_id={order['id']}"
    )

@app.get("/api/payment/verify")
async def verify_payment(order_id: str):
    """Verify an order's payment with Flutterwave.

    check_order_status validates tx_ref/amount/currency server-side and
    persists the paid status (which also decrements stock and notifies the
    seller exactly once). Used by the /pay/callback page and the inline
    checkout success callback.
    """
    from customer_tools import check_order_status
    status = await run_in_threadpool(check_order_status, order_id)
    return {"order_id": order_id, "status": status}


def _order_id_from_tx_ref(tx_ref: str) -> Optional[str]:
    """Our tx_ref format is 'sharpshop_{order_id}'."""
    if tx_ref and tx_ref.startswith("sharpshop_"):
        return tx_ref[len("sharpshop_"):]
    return None


@app.post("/api/webhook/flutterwave")
async def flutterwave_webhook(request: Request):
    """Server-to-server payment confirmation from Flutterwave.

    The webhook is only a *trigger*: we authenticate it via the verif-hash
    header, then re-verify the transaction through check_order_status (which
    re-queries Flutterwave and checks amount/currency/tx_ref) rather than
    trusting the webhook body. This makes confirmation reliable even if the
    customer closes the browser before the redirect.
    """
    from customer_config import FLUTTERWAVE_SECRET_HASH
    from customer_tools import check_order_status

    # 1. Authenticate the webhook
    signature = request.headers.get("verif-hash", "")
    if not FLUTTERWAVE_SECRET_HASH:
        logging.warning("FLUTTERWAVE_SECRET_HASH not set — rejecting webhook")
        return Response(status_code=401)
    if signature != FLUTTERWAVE_SECRET_HASH:
        logging.warning("Rejected Flutterwave webhook with invalid verif-hash")
        return Response(status_code=401)

    # 2. Pull the tx_ref out of the payload
    try:
        payload = await request.json()
    except Exception:
        return Response(status_code=400)

    data = payload.get("data") or {}
    tx_ref = data.get("tx_ref") or data.get("txRef") or ""
    order_id = _order_id_from_tx_ref(tx_ref)
    if not order_id:
        logging.info(f"Flutterwave webhook ignored (no sharpshop tx_ref): {tx_ref!r}")
        return Response(status_code=200)  # 200 so Flutterwave doesn't retry

    # 3. Re-verify and persist (never trust the webhook body for the decision)
    status = await run_in_threadpool(check_order_status, order_id)
    logging.info(f"Flutterwave webhook: order {order_id} -> {status}")
    return {"order_id": order_id, "status": status}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)