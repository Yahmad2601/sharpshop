import os
from dotenv import load_dotenv

load_dotenv()

# Model settings
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
ALLOWED_CATEGORIES = ["Electronics", "Fashion", "Footwear", "Accessories", "Home & Living", "Food & Drinks"]

MODEL_NAME = os.getenv("CUSTOMER_AGENT_MODEL", "llama-3.3-70b-versatile")
MODEL_TEMPERATURE = 0.7
MAX_TOKENS = 500

# Session settings
SESSION_TTL = int(os.getenv("CUSTOMER_SESSION_TTL", "1800"))
MAX_SESSION_MESSAGES = int(os.getenv("CUSTOMER_MAX_SESSION_MESSAGES", "50"))
MAX_SESSION_DURATION = 7200  # 2 hours
CLEANUP_INTERVAL = 300  # 5 minutes

# Rate limiting
RATE_LIMIT_PER_MINUTE = int(os.getenv("CUSTOMER_RATE_LIMIT_PER_MINUTE", "30"))
RATE_LIMIT_PER_HOUR = int(os.getenv("CUSTOMER_RATE_LIMIT_PER_HOUR", "1000"))
MAX_CONCURRENT_SESSIONS = int(os.getenv("CUSTOMER_MAX_CONCURRENT_SESSIONS", "10000"))

# Response settings
MAX_PRODUCTS_IN_RESPONSE = 5
INCLUDE_PRODUCT_IMAGES = True
ENCOURAGE_WHATSAPP_CONTACT = True

# Payment Settings
FLUTTERWAVE_SECRET_KEY = os.getenv("FLUTTERWAVE_SECRET_KEY", "")
FLUTTERWAVE_PUBLIC_KEY = os.getenv("FLUTTERWAVE_PUBLIC_KEY", "")
FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3"
# Secret hash you set in the Flutterwave dashboard webhook settings. Incoming
# webhooks must send it in the "verif-hash" header or they're rejected.
FLUTTERWAVE_SECRET_HASH = os.getenv("FLUTTERWAVE_SECRET_HASH", "")

# Twilio (shared with the seller bot). WHATSAPP_FROM is the sender number in
# Twilio's "whatsapp:+14155238886" format; defaults to the public sandbox.
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
