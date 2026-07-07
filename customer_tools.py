from typing import List, Dict, Optional, Any
from datetime import datetime, timezone, timedelta
import re
import requests
from database import get_supabase
from config import ALLOWED_CATEGORIES
from customer_config import FLUTTERWAVE_BASE_URL, FLUTTERWAVE_SECRET_KEY

# (connect, read) timeouts for external payment gateway calls
REQUEST_TIMEOUT = (5, 15)

# --- Pre-order / "Drop" deadline helpers ---

def parse_deadline(value) -> Optional[datetime]:
    """Parse an order deadline into an aware datetime. Accepts ISO 8601;
    naive values are assumed to be Lagos time (UTC+1)."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone(timedelta(hours=1)))
    return dt


def deadline_passed(value) -> bool:
    """True if a drop's order deadline is set and already in the past."""
    dt = parse_deadline(value)
    return dt is not None and datetime.now(timezone.utc) >= dt

def get_shop_info(trader_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve trader profile information."""
    supabase = get_supabase()
    
    # Get trader details
    response = supabase.table("traders").select("*").eq("id", trader_id).execute()
    if not response.data:
        return None
        
    trader = response.data[0]
    
    # Get product count
    prod_response = supabase.table("products").select("id", count="exact").eq("trader_id", trader_id).eq("is_active", True).execute()
    product_count = prod_response.count if prod_response.count is not None else 0
    
    return {
        "business_name": trader.get("business_name"),
        "whatsapp_number": trader.get("whatsapp_number"),
        "address": trader.get("address"), # Assuming address field exists or return None
        "bio": trader.get("bio"),         # Assuming bio field exists or return None
        "product_count": product_count
    }

def _sanitize_search_term(query: str) -> str:
    """Strip characters that break the PostgREST or= filter syntax."""
    return re.sub(r"[,()%\\]", " ", query or "").strip()


def search_shop_products(trader_id: str, query: str) -> Dict[str, Any]:
    """Search products by keyword (name or description) within a shop."""
    supabase = get_supabase()

    term = _sanitize_search_term(query)
    if not term:
        return {"results": [], "total": 0}

    try:
        response = supabase.table("products") \
            .select("*") \
            .eq("trader_id", trader_id) \
            .eq("is_active", True) \
            .or_(f"name.ilike.%{term}%,description.ilike.%{term}%") \
            .order("stock_quantity", desc=True) \
            .execute()
    except Exception as e:
        print(f"Search error: {e}")
        # Fallback to name-only search if the or= filter fails
        response = supabase.table("products") \
            .select("*") \
            .eq("trader_id", trader_id) \
            .eq("is_active", True) \
            .ilike("name", f"%{term}%") \
            .order("stock_quantity", desc=True) \
            .execute()

    results = []
    for p in response.data:
        results.append({
            "id": p["id"],
            "name": p["name"],
            "price": p["price"],
            "category": p["category"],
            "stock_quantity": p["stock_quantity"],
            "image_url": p.get("image_url", ""),
            "description": p.get("description", ""),
            "is_preorder": p.get("is_preorder", False),
            "order_deadline": p.get("order_deadline"),
            "max_capacity": p.get("max_capacity"),
        })
        
    return {
        "results": results,
        "total": len(results)
    }

def get_product_details(trader_id: str, product_id: str) -> Optional[Dict[str, Any]]:
    """Get full details of a specific product."""
    supabase = get_supabase()
    
    response = supabase.table("products") \
        .select("*") \
        .eq("id", product_id) \
        .eq("trader_id", trader_id) \
        .execute()
        
    if response.data:
        return response.data[0]
    return None

def check_product_availability(product_id: str, trader_id: str) -> Dict[str, Any]:
    """Real-time stock check. For pre-order drops, stock_quantity is the
    remaining slots and the deadline also gates availability."""
    product = get_product_details(trader_id, product_id)
    if not product:
        return {"available": False, "stock_quantity": 0, "product_name": "Unknown"}

    if product.get("is_preorder") and deadline_passed(product.get("order_deadline")):
        return {
            "available": False,
            "stock_quantity": product["stock_quantity"],
            "product_name": product["name"],
            "reason": "orders_closed",
        }

    return {
        "available": product["stock_quantity"] > 0,
        "stock_quantity": product["stock_quantity"],
        "product_name": product["name"]
    }

def get_shop_products(trader_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Fetch a list of active products for the shop preview."""
    supabase = get_supabase()
    
    response = supabase.table("products") \
        .select("*") \
        .eq("trader_id", trader_id) \
        .eq("is_active", True) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
        
    return response.data

def create_order(trader_id: str, product_id: str, fulfillment_type: str, delivery_details: dict,
                 amount: Optional[float] = None) -> Dict[str, Any]:
    """Create a new order. Pass `amount` if the product price is already known to skip a fetch."""
    supabase = get_supabase()

    prod = get_product_details(trader_id, product_id)
    if not prod:
        raise ValueError(f"Product {product_id} not found for trader {trader_id}")
    if prod.get("is_preorder") and deadline_passed(prod.get("order_deadline")):
        raise ValueError("Orders for this drop have closed")
    if amount is None:
        amount = prod["price"]

    order_data = {
        "trader_id": trader_id,
        "product_id": product_id,
        "amount": amount,
        "currency": "NGN",
        "fulfillment_type": fulfillment_type,
        "delivery_details": delivery_details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    response = supabase.table("orders").insert(order_data).execute()

    if response.data:
        return response.data[0]

    raise Exception("Failed to create order")

def create_payment_link(order_id: str, amount: Optional[float] = None) -> Optional[str]:
    """Generate a Flutterwave payment link. Returns None on failure."""
    if amount is None:
        supabase = get_supabase()
        order_resp = supabase.table("orders").select("amount").eq("id", order_id).execute()
        if not order_resp.data:
            print(f"Payment link error: order {order_id} not found")
            return None
        amount = order_resp.data[0]["amount"]

    payload = {
        "tx_ref": f"sharpshop_{order_id}",
        "amount": str(amount),
        "currency": "NGN",
        "redirect_url": f"https://sharpshop.app/pay/callback?order_id={order_id}",
        "customer": {
            "email": "customer@sharpshop.app",
            "phonenumber": "08000000000",
            "name": "SharpShop Customer"
        },
        "customizations": {
            "title": "SharpShop Payment",
            "description": f"Payment for Order {order_id}"
        }
    }
    headers = {
        "Authorization": f"Bearer {FLUTTERWAVE_SECRET_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(f"{FLUTTERWAVE_BASE_URL}/payments", json=payload, headers=headers,
                                 timeout=REQUEST_TIMEOUT)
        data = response.json()
        if data.get("status") == "success":
            return data["data"]["link"]
        print(f"Flutterwave Error: {data}")
        return None
    except Exception as e:
        print(f"Payment Link Error: {e}")
        return None

def check_order_status(order_id: str) -> str:
    """Verify an order's payment with Flutterwave and persist the result.

    Returns "paid", "pending", or "error". A transaction only counts as paid if
    its tx_ref, currency, and amount all match the order — inline checkout lets
    the client control the charge config, so status alone must not be trusted.
    """
    supabase = get_supabase()
    order_resp = supabase.table("orders").select("*").eq("id", order_id).execute()
    if not order_resp.data:
        return "error"
    order = order_resp.data[0]
    if order.get("status") == "paid":
        return "paid"

    tx_ref = f"sharpshop_{order_id}"
    url = f"{FLUTTERWAVE_BASE_URL}/transactions/verify_by_reference?tx_ref={tx_ref}"
    headers = {
        "Authorization": f"Bearer {FLUTTERWAVE_SECRET_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        data = response.json()
    except Exception as e:
        print(f"Verify Error: {e}")
        return "error"

    tx = data.get("data") or {}
    if data.get("status") != "success" or tx.get("status") != "successful":
        return "pending"

    if (tx.get("tx_ref") != tx_ref
            or tx.get("currency") != order.get("currency", "NGN")
            or float(tx.get("amount") or 0) < float(order["amount"])):
        print(f"⚠️ Payment mismatch for order {order_id}: "
              f"paid {tx.get('amount')} {tx.get('currency')} vs order {order['amount']} {order.get('currency')}")
        return "pending"

    _mark_order_paid(order)
    return "paid"

def _mark_order_paid(order: dict) -> None:
    """Mark order paid and decrement stock atomically via the confirm_order_paid RPC
    (see DB_SETUP_INSTRUCTIONS.txt). Falls back to non-atomic updates if the RPC
    is not deployed yet. Notifies the seller exactly once, on the pending->paid
    transition (never on re-verification of an already-paid order)."""
    supabase = get_supabase()
    order_id = order["id"]

    try:
        result = supabase.rpc("confirm_order_paid", {"p_order_id": order_id}).execute()
        if result.data == "paid_out_of_stock":
            print(f"⚠️ Order {order_id} paid but product {order['product_id']} is out of stock — needs refund/follow-up")
        if result.data in ("paid", "paid_out_of_stock"):
            notify_seller(order_id)
        return
    except Exception as e:
        print(f"confirm_order_paid RPC unavailable ({e}); using non-atomic fallback")

    try:
        resp = supabase.table("orders").update({"status": "paid", "payment_ref": f"sharpshop_{order_id}"}) \
            .eq("id", order_id).eq("status", "pending").execute()
        if not resp.data:
            return  # already paid — nothing transitioned, don't decrement/notify again
        prod_resp = supabase.table("products").select("stock_quantity").eq("id", order["product_id"]).execute()
        if prod_resp.data and prod_resp.data[0]["stock_quantity"] > 0:
            supabase.table("products").update({"stock_quantity": prod_resp.data[0]["stock_quantity"] - 1}) \
                .eq("id", order["product_id"]).execute()
        notify_seller(order_id)
    except Exception as e:
        print(f"Failed to persist paid status for order {order_id}: {e}")

def save_delivery_details(order_id: str, details: dict) -> bool:
    """Persist collected delivery details onto the order."""
    supabase = get_supabase()
    try:
        supabase.table("orders").update({"delivery_details": details}).eq("id", order_id).execute()
        return True
    except Exception as e:
        print(f"Failed to save delivery details for order {order_id}: {e}")
        return False

def _send_whatsapp(to_number: str, body: str) -> bool:
    """Send a WhatsApp message via Twilio. Returns False (and logs) if Twilio
    isn't configured, so a missing credential never breaks the payment flow."""
    from customer_config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN):
        print(f"🔔 (Twilio not configured) would notify {to_number}: {body}")
        return False

    # Twilio expects E.164 in "whatsapp:+234..." form
    digits = "".join(ch for ch in to_number if ch.isdigit())
    if not digits:
        print(f"Notification skipped: seller has no usable phone number ({to_number!r})")
        return False
    to = f"whatsapp:+{digits}"

    try:
        from twilio.rest import Client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        client.messages.create(from_=TWILIO_WHATSAPP_FROM, to=to, body=body)
        print(f"🔔 Notified seller {to}")
        return True
    except Exception as e:
        print(f"Twilio send failed for {to}: {e}")
        return False


def notify_seller(order_id: str) -> bool:
    """Send a WhatsApp notification to the seller about a paid order."""
    supabase = get_supabase()
    try:
        order_resp = supabase.table("orders") \
            .select("trader_id, amount, currency, product_id") \
            .eq("id", order_id).execute()
        if not order_resp.data:
            print(f"Notification skipped: order {order_id} not found")
            return False
        order = order_resp.data[0]

        trader_resp = supabase.table("traders").select("whatsapp_number, business_name") \
            .eq("id", order["trader_id"]).execute()
        if not trader_resp.data:
            print(f"Notification skipped: trader for order {order_id} not found")
            return False

        phone = trader_resp.data[0].get("whatsapp_number")
        if not phone:
            print(f"Notification skipped: trader {order['trader_id']} has no WhatsApp number")
            return False

        product_name = "your product"
        prod_resp = supabase.table("products").select("name").eq("id", order["product_id"]).execute()
        if prod_resp.data:
            product_name = prod_resp.data[0]["name"]

        amount = f"{order.get('currency', 'NGN')} {float(order['amount']):,.0f}"
        message = (
            f"🎉 New paid order on SharpShop!\n\n"
            f"Product: {product_name}\n"
            f"Amount: {amount}\n"
            f"Order ID: {order_id}\n\n"
            f"Open your dashboard to view delivery details."
        )
        return _send_whatsapp(phone, message)

    except Exception as e:
        print(f"Notification Error: {e}")
        return False
