from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
import re
import requests
from database import get_supabase
from config import ALLOWED_CATEGORIES
from customer_config import FLUTTERWAVE_BASE_URL, FLUTTERWAVE_SECRET_KEY

# (connect, read) timeouts for external payment gateway calls
REQUEST_TIMEOUT = (5, 15)

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
            "description": p.get("description", "")
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

def get_products_by_category(trader_id: str, category: str) -> List[Dict[str, Any]]:
    """Filter products by category."""
    if category not in ALLOWED_CATEGORIES:
        return []
        
    supabase = get_supabase()
    response = supabase.table("products") \
        .select("*") \
        .eq("trader_id", trader_id) \
        .eq("is_active", True) \
        .eq("category", category) \
        .order("stock_quantity", desc=True) \
        .execute()
        
    return response.data

def check_product_availability(product_id: str, trader_id: str) -> Dict[str, Any]:
    """Real-time stock check."""
    product = get_product_details(trader_id, product_id)
    if not product:
        return {"available": False, "stock_quantity": 0, "product_name": "Unknown"}
        
    return {
        "available": product["stock_quantity"] > 0,
        "stock_quantity": product["stock_quantity"],
        "product_name": product["name"]
    }

def get_price_range(trader_id: str) -> Dict[str, float]:
    """Help customers filter by budget."""
    supabase = get_supabase()
    
    # We need aggregations (min, max, avg). Supabase-py doesn't have direct aggregation helper 
    # in the fluent API easily without RPC or raw SQL usually.
    # Since we can't easily add RPC, we'll fetch prices and calc in python 
    # (assuming product count isn't massive logic).
    # Ideally should use .select('price')
    
    response = supabase.table("products") \
        .select("price") \
        .eq("trader_id", trader_id) \
        .eq("is_active", True) \
        .execute()
        
    prices = [p['price'] for p in response.data if p.get('price') is not None]
    
    if not prices:
        return {"min_price": 0, "max_price": 0, "average_price": 0}
        
    return {
        "min_price": min(prices),
        "max_price": max(prices),
        "average_price": sum(prices) / len(prices)
    }

def get_products_in_price_range(trader_id: str, min_price: float, max_price: float) -> List[Dict[str, Any]]:
    """Find products within budget."""
    supabase = get_supabase()
    
    response = supabase.table("products") \
        .select("*") \
        .eq("trader_id", trader_id) \
        .eq("is_active", True) \
        .gte("price", min_price) \
        .lte("price", max_price) \
        .order("price", desc=False) \
        .execute()
        
    return response.data

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

    if amount is None:
        prod = get_product_details(trader_id, product_id)
        if not prod:
            raise ValueError(f"Product {product_id} not found for trader {trader_id}")
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

def notify_seller(order_id: str) -> bool:
    """Notify the seller about a paid order.

    NOTE: actual WhatsApp/SMS delivery is not implemented yet — this resolves the
    real seller contact and logs the message so the send call can be dropped in later.
    """
    supabase = get_supabase()
    try:
        order_resp = supabase.table("orders").select("trader_id").eq("id", order_id).execute()
        if not order_resp.data:
            print(f"Notification skipped: order {order_id} not found")
            return False

        trader_resp = supabase.table("traders").select("whatsapp_number, business_name") \
            .eq("id", order_resp.data[0]["trader_id"]).execute()
        if not trader_resp.data:
            print(f"Notification skipped: trader for order {order_id} not found")
            return False

        phone = trader_resp.data[0]["whatsapp_number"]
        message = f"New paid order on SharpShop! Order ID: {order_id}. Please check your dashboard."
        # TODO: send via Twilio WhatsApp once an outbound sender number is configured
        print(f"🔔 NOTIFY SELLER {phone}: {message}")
        return True

    except Exception as e:
        print(f"Notification Error: {e}")
        return False
