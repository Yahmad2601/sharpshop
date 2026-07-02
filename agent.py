"""LangGraph-based AI agent for inventory management."""
import json
import re
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

from typing import TypedDict, Literal
from langgraph.graph import StateGraph, END
from openai import OpenAI
from database import get_trader_by_whatsapp

from config import GROQ_API_KEY, GROQ_BASE_URL, MODEL_NAME, ALLOWED_CATEGORIES
from tools import create_product, query_inventory, update_product, list_products

REQUIRED_FIELDS = ["name", "price", "category", "stock"]
OPTIONAL_FIELDS = ["description", "image"]
# Keys the LLM may pass through to create_product(**data)
CREATE_PRODUCT_FIELDS = {"name", "price", "category", "stock", "description"}


def normalize_naira_price(value) -> int | None:
    """Normalize common Nigerian WhatsApp price formats into integer Naira.

    Examples:
    - "5k", "5 K" -> 5000
    - "₦12k" -> 12000
    - "250" (no currency, < 1000) -> 250000
    - "15000" -> 15000
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        n = int(value)
        return n if n > 0 else None

    s = str(value).strip().lower()
    s = s.replace("₦", "").replace(",", "").strip()

    # 5k / 5.5k / 5 k
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*k", s)
    if m:
        return max(1, int(float(m.group(1)) * 1000))

    # plain number
    m = re.fullmatch(r"\d+(?:\.\d+)?", s)
    if m:
        n = int(float(s))
        if n <= 0:
            return None
        # Common Naija shorthand: "250" means 250k
        return n * 1000 if n < 1000 else n

    return None

SYSTEM_PROMPT = f"""You are a helpful WhatsApp assistant for Nigerian sellers managing their shop inventory.
Your job: understand casual Nigerian English / pidgin and turn it into ONE correct JSON action.

Understand informal patterns (examples):
- "this shoe na 5k" == the item costs 5000 Naira
- "I get 10 for hand" == stock is 10
- "condition good / e clean / like new" == good condition (use in description)
- Typos/short forms: "iphne", "adiddas", "sneekers", "wif", "gud" etc.

Be smart and avoid repeated questions:
- Infer missing info from context/history whenever possible.
- Only ask a follow-up question if you truly cannot create a valid listing.
- Default non-critical fields to reasonable values.

## Fields (be flexible)
- name: REQUIRED (can infer from message + image context). If unclear, use a short best-guess like "Adidas sneakers".
- price: REQUIRED. Extract and convert to an integer Naira amount.
  Price formats:
  - "5k", "5 K", "5,5k" => 5000 (k means thousand)
  - "₦12k" => 12000
  - If the seller sends just a number with no currency (common Nigerian style):
     - If it's < 1000 (e.g., "250"), treat it as thousands => 250000
     - If it's >= 1000 (e.g., "15000"), use it as-is
- category: NOT strictly required to ask for. Infer from product name using common sense.
  Use one of these categories only: {', '.join(ALLOWED_CATEGORIES)}
  Examples of category inference:
  - Adidas/Nike/sneakers/shoe/slippers/sandals/heel/boot => Footwear
  - iPhone/Samsung/Infinix/phone/earpods/airpods/charger/powerbank => Electronics
  - wig/hair/cream/perfume/makeup/lipstick => Beauty
  - jeans/shirt/top/bag/watch => Fashion
  If unsure, pick the closest reasonable category.
- stock: If not mentioned, default to 1. If seller says "available" assume 1.
  Understand: "I get 10", "10pcs", "10 dey", "10 for hand".
- description: If not provided, generate a short simple one from context.
  Include condition words if mentioned (e.g., "Condition: good" / "Clean"), and basic selling points.

## Actions
When a seller wants to add a product, extract what you can and output create_product.
When they want to search/ask for stock, output query_inventory.
When they want to list all products, output list_products.
When they want to update something, output update_product.

## Examples (casual input -> interpretation)
1) "this shoe na 5k, I get 10 for hand, condition good"
    -> name: "Shoe" (or "Sneakers"), price: 5000, stock: 10, description includes "condition good", category: Footwear
2) "Adidas black size 42 15k"
    -> name: "Adidas black shoe (size 42)", price: 15000, category: Footwear
3) "iphone 11 250, clean" (no currency)
    -> price: 250000, name: "iPhone 11", category: Electronics, description: "Clean, good condition"
4) "how many Nike remain" / "check Nike for me"
    -> query_inventory search_term: "Nike"
5) "increase adidas price to 18k"
    -> update_product product_name: "adidas", updates.price: 18000

Output format (respond with ONLY the JSON, nothing else):
```json
{{"action": "create_product", "data": {{"name": "Nike sneakers", "price": 45000, "category": "Fashion", "stock": 5, "description": "Brand new Nike sneakers in excellent condition"}}}}
```

For queries/searches:
```json
{{"action": "query_inventory", "data": {{"search_term": "Nike"}}}}
```

For listing all products:
```json
{{"action": "list_products", "data": {{}}}}
```

For updating a product (price, stock, etc.):
```json
{{"action": "update_product", "data": {{"product_name": "esp32 microcontroller", "updates": {{"price": 11000}}}}}}
```
Note: You can update: price, stock_quantity, description, name, category, is_active.
"""


class AgentState(TypedDict):
    messages: list[dict]
    trader_id: str
    trader_name: str
    whatsapp_number: str
    pending_action: str | None
    collected_data: dict
    image_url: str | None


def create_client() -> OpenAI:
    return OpenAI(base_url=GROQ_BASE_URL, api_key=GROQ_API_KEY)


def process_message(state: AgentState) -> AgentState:
    """Process incoming message and generate response."""
    client = create_client()
    
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add context about collected data if any
    if state["collected_data"]:
        context = f"\n\nCurrent collected data: {json.dumps(state['collected_data'])}"
        missing = [f for f in REQUIRED_FIELDS if f not in state["collected_data"]]
        if missing:
            context += f"\nMissing required fields: {', '.join(missing)}"
        messages[0]["content"] += context
    
    if state["image_url"]:
        messages[0]["content"] += f"\n\nImage provided: {state['image_url']}"
    
    messages.extend(state["messages"])
    
    response = client.chat.completions.create(model=MODEL_NAME, messages=messages, temperature=0.7)
    assistant_msg = response.choices[0].message.content
    
    new_state = state.copy()
    new_state["messages"] = state["messages"] + [{"role": "assistant", "content": assistant_msg}]
    
    # Check for action JSON in response (with or without markdown code blocks)
    json_match = re.search(r'```json\s*(\{.*?\})\s*```', assistant_msg, re.DOTALL)
    if not json_match:
        # Try finding complete JSON object (matching braces)
        start_idx = assistant_msg.find('{"action"')
        if start_idx >= 0:
            # Find matching closing brace
            brace_count = 0
            in_string = False
            escape = False
            for i, char in enumerate(assistant_msg[start_idx:], start=start_idx):
                if escape:
                    escape = False
                    continue
                if char == '\\':
                    escape = True
                    continue
                if char == '"' and not escape:
                    in_string = not in_string
                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            json_str = assistant_msg[start_idx:i+1]
                            break
            else:
                json_str = None
        else:
            json_str = None
    else:
        json_str = json_match.group(1)
    
    if json_str:
        try:
            action_data = json.loads(json_str)
            new_state["pending_action"] = action_data.get("action")
            new_state["collected_data"] = action_data.get("data", {})
        except json.JSONDecodeError:
            pass
    
    return new_state


def execute_action(state: AgentState) -> AgentState:
    """Execute the pending action if data is complete."""
    action = state["pending_action"]
    data = state["collected_data"]
    result_msg = ""
    
    if action == "create_product":
        # The LLM sometimes emits extra keys (brand, size, ...) that create_product
        # doesn't accept — keep only known fields so **data can't TypeError.
        data = {k: v for k, v in data.items() if k in CREATE_PRODUCT_FIELDS}

        # Normalize price ("5k", "₦12k", "250") into integer Naira
        price = normalize_naira_price(data.get("price"))
        if price is not None:
            data["price"] = price

        missing = [f for f in ("name", "price") if not data.get(f)]
        if missing:
            result_msg = f"I still need the product {' and '.join(missing)} to create the listing. Please send it."
            new_state = state.copy()
            new_state["messages"] = state["messages"] + [{"role": "assistant", "content": result_msg}]
            new_state["collected_data"] = data  # keep what we have so far
            return new_state

        try:
            data["stock"] = int(data.get("stock", 1))
        except (TypeError, ValueError):
            data["stock"] = 1
        if data.get("category") not in ALLOWED_CATEGORIES:
            data["category"] = "Fashion"

        # Check if image is provided - REQUIRE image for product creation
        if not state["image_url"]:
            result_msg = "📸 Please send a photo of your product! I need an image to create the listing.\n\nJust send the photo and I'll add it to your product."
            # Keep the collected data so we can use it when image arrives
            new_state = state.copy()
            new_state["messages"] = state["messages"] + [{"role": "assistant", "content": result_msg}]
            # Don't clear pending_action or collected_data - we're waiting for image
            return new_state

        # Add trader info and image
        data["trader_id"] = state["trader_id"]
        data["trader_name"] = state["trader_name"]
        data["whatsapp_number"] = state["whatsapp_number"]
        data["image"] = state["image_url"]
        result = create_product(**data)
        if result["success"]:
            result_msg = f"✅ Product added! Your {data.get('name', 'item')} is now listed. (ID: {result['product_id']})"
        else:
            result_msg = f"❌ Couldn't add product: {result['error']}"
    
    elif action == "query_inventory":
        result = query_inventory(data.get("search_term", ""), state["trader_id"])
        if result["results"]:
            items = "\n".join([f"• {p['name']} - ₦{p['price']:,} ({p['stock_quantity']} in stock)" for p in result["results"]])
            result_msg = f"📦 Found {result['total']} items:\n{items}"
        else:
            result_msg = "No products found matching your search."
    
    elif action == "update_product":
        # First search for the product by name
        product_name = data.get("product_name", "")
        if not product_name:
            result_msg = "❌ I need the product name to update it. Which product do you want to update?"
        else:
            search_result = query_inventory(product_name, state["trader_id"])
            if not search_result["results"]:
                result_msg = f"❌ I couldn't find any product matching '{product_name}'. Please check the name and try again."
            elif len(search_result["results"]) > 1:
                items = "\n".join([f"• {p['name']} (ID: {p['id'][:8]}...)" for p in search_result["results"]])
                result_msg = f"I found multiple products:\n{items}\n\nPlease be more specific about which one to update."
            else:
                # Found exactly one product
                product = search_result["results"][0]
                product_id = product["id"]
                updates = data.get("updates", {})
                
                # Normalize field names: "stock" -> "stock_quantity"
                if "stock" in updates:
                    updates["stock_quantity"] = updates.pop("stock")

                # Normalize price shorthand ("18k") into integer Naira
                if "price" in updates:
                    normalized_price = normalize_naira_price(updates["price"])
                    if normalized_price is not None:
                        updates["price"] = normalized_price

                result = update_product(product_id, updates, state["trader_id"])
                
                if result["success"]:
                    # Show what was updated
                    updated_fields = ", ".join([f"{k}: {v}" for k, v in updates.items()])
                    result_msg = f"✅ Updated {product['name']}! Changed: {updated_fields}"
                else:
                    result_msg = f"❌ Update failed: {result['error']}"
    
    elif action == "list_products":
        result = list_products(state["trader_id"], data.get("limit", 10))
        if result["products"]:
            items = "\n".join([f"• {p['name']} - ₦{p['price']:,} ({p['stock_quantity']} in stock)" for p in result["products"]])
            result_msg = f"📦 Your {result['total']} products:\n{items}"
        else:
            result_msg = "You haven't added any products yet."
    
    if not result_msg:
        result_msg = "Sorry, I couldn't process that. You can add a product, list your products, check stock, or update a product."

    new_state = state.copy()
    new_state["messages"] = state["messages"] + [{"role": "assistant", "content": result_msg}]
    new_state["pending_action"] = None
    new_state["collected_data"] = {}
    new_state["image_url"] = None
    return new_state


def should_execute(state: AgentState) -> Literal["execute", "end"]:
    """Determine if we should execute an action or end."""
    # Note: don't require collected_data to be non-empty — list_products
    # legitimately arrives with data == {}.
    if state["pending_action"]:
        return "execute"
    return "end"


def build_graph() -> StateGraph:
    """Build the LangGraph state machine."""
    graph = StateGraph(AgentState)
    graph.add_node("process", process_message)
    graph.add_node("execute", execute_action)
    graph.set_entry_point("process")
    graph.add_conditional_edges("process", should_execute, {"execute": "execute", "end": END})
    graph.add_edge("execute", END)
    return graph.compile()


# Compile once at import time; recompiling per message is pure overhead
_GRAPH = build_graph()


def create_initial_state(whatsapp_number: str, business_name: str = "My Shop",
                         trader: dict | None = None) -> AgentState:
    """Create initial state for a new conversation.

    Pass `trader` if already fetched (the webhook looks it up first) to avoid
    a duplicate round of DB lookups.
    """
    if trader is None:
        trader = get_trader_by_whatsapp(whatsapp_number)
    if not trader:
        raise ValueError(f"No registered trader found for {whatsapp_number}")
    return {
        "messages": [],
        "trader_id": trader["id"],
        "trader_name": trader["business_name"],
        "whatsapp_number": whatsapp_number,
        "pending_action": None,
        "collected_data": {},
        "image_url": None
    }


def chat(state: AgentState, user_message: str, image_url: str = None) -> AgentState:
    """Process a user message and return updated state."""
    new_state = state.copy()
    new_state["messages"] = state["messages"] + [{"role": "user", "content": user_message}]
    if image_url:
        new_state["image_url"] = image_url

    return _GRAPH.invoke(new_state)
