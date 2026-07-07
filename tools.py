"""Supabase-backed tool implementations for inventory management."""
from typing import Optional
from config import ALLOWED_CATEGORIES
from database import get_supabase
from customer_tools import parse_deadline, deadline_passed

# Columns the agent is allowed to modify; anything else from LLM output is dropped
UPDATABLE_FIELDS = {
    "price", "stock_quantity", "description", "name", "category", "is_active",
    # Drop/pre-order fields (e.g. "extend my cupcake drop to Saturday")
    "is_preorder", "order_deadline", "max_capacity",
}

def validate_product_data(data: dict) -> tuple[bool, str]:
    """Validate product data before creation/update."""
    if "price" in data and (not isinstance(data["price"], (int, float)) or data["price"] <= 0):
        return False, "Price must be greater than 0"
    if "stock_quantity" in data and (not isinstance(data["stock_quantity"], int) or data["stock_quantity"] < 0):
        return False, "Stock must be 0 or greater"
    if "category" in data and data["category"] not in ALLOWED_CATEGORIES:
        return False, f"Category must be one of: {', '.join(ALLOWED_CATEGORIES)}"
    return True, ""


def create_product(
    name: str,
    price: float,
    category: str,
    stock: int,
    trader_id: str,
    trader_name: str,
    whatsapp_number: str,
    description: Optional[str] = None,
    image: Optional[str] = None,
    is_active: bool = True,
    is_preorder: bool = False,
    order_deadline: Optional[str] = None,
    max_capacity: Optional[int] = None,
) -> dict:
    """Create a product listing. For pre-order "drops", stock_quantity holds
    the remaining slots (initialized to max_capacity) so the existing atomic
    decrement machinery enforces capacity."""
    if is_preorder:
        if not order_deadline or not max_capacity:
            return {"success": False, "error": "A pre-order needs an order deadline and a maximum capacity."}
        if parse_deadline(order_deadline) is None:
            return {"success": False, "error": "I couldn't understand the order deadline date."}
        if deadline_passed(order_deadline):
            return {"success": False, "error": "That order deadline is already in the past."}
        if not isinstance(max_capacity, int) or max_capacity < 1:
            return {"success": False, "error": "Maximum capacity must be at least 1."}
        stock = max_capacity  # remaining slots

    data = {"price": price, "category": category, "stock_quantity": stock}
    valid, error = validate_product_data(data)
    if not valid:
        return {"success": False, "error": error}

    supabase = get_supabase()

    # Image is now required - validated in agent before calling this function
    if not image:
        return {"success": False, "error": "Product image is required. Please send a photo of your product."}

    product_data = {
        "trader_id": trader_id,
        "trader_name": trader_name,
        "whatsapp_number": whatsapp_number,
        "name": name,
        "price": price,
        "category": category,
        "stock_quantity": stock,
        "description": description or f"Great {name} available now!",
        "image_url": image,
        "is_active": is_active,
        "is_preorder": is_preorder,
        "order_deadline": parse_deadline(order_deadline).isoformat() if is_preorder else None,
        "max_capacity": max_capacity if is_preorder else None,
    }
    
    try:
        result = supabase.table("products").insert(product_data).execute()
        product = result.data[0]
        return {
            "success": True,
            "product_id": product["id"],
            "message": f"Product '{name}' created successfully"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def query_inventory(search_term: str, trader_id: str) -> dict:
    """Search inventory by term."""
    supabase = get_supabase()
    
    try:
        query = supabase.table("products").select("*").eq("trader_id", trader_id)
        
        if search_term:
            query = query.ilike("name", f"%{search_term}%")
        
        result = query.execute()
        
        return {
            "success": True,
            "results": result.data,
            "total": len(result.data)
        }
    except Exception as e:
        return {"success": False, "error": str(e), "results": [], "total": 0}


def update_product(product_id: str, updates: dict, trader_id: str) -> dict:
    """Update an existing product."""
    updates = {k: v for k, v in updates.items() if k in UPDATABLE_FIELDS}
    if not updates:
        return {"success": False, "error": "No valid fields to update"}

    valid, error = validate_product_data(updates)
    if not valid:
        return {"success": False, "error": error}
    
    supabase = get_supabase()
    
    try:
        # Check if product belongs to trader
        check = supabase.table("products").select("id").eq("id", product_id).eq("trader_id", trader_id).execute()
        
        if not check.data:
            return {"success": False, "error": "Product not found or you don't have permission"}
        
        result = supabase.table("products").update(updates).eq("id", product_id).execute()
        
        return {
            "success": True,
            "product_id": product_id,
            "message": "Product updated successfully"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def list_products(trader_id: str, limit: int = 10) -> dict:
    """List trader's products."""
    supabase = get_supabase()
    
    try:
        result = supabase.table("products").select("*").eq("trader_id", trader_id).limit(limit).execute()
        
        return {
            "success": True,
            "products": result.data,
            "total": len(result.data)
        }
    except Exception as e:
        return {"success": False, "error": str(e), "products": [], "total": 0}