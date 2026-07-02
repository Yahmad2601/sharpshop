"""Tests for pure helper logic across the agents and tools."""
from agent import normalize_naira_price, should_execute, CREATE_PRODUCT_FIELDS
from customer_tools import _sanitize_search_term
from customer_agent import (
    _slim_tool_results,
    ALLOWED_STATE_UPDATE_KEYS,
    ALLOWED_NEXT_STATES,
)
import server


class TestNormalizeNairaPrice:
    def test_k_suffix(self):
        assert normalize_naira_price("5k") == 5000
        assert normalize_naira_price("5 K") == 5000
        assert normalize_naira_price("₦12k") == 12000

    def test_bare_number_under_1000_is_thousands(self):
        assert normalize_naira_price("250") == 250000

    def test_bare_number_over_1000_as_is(self):
        assert normalize_naira_price("15000") == 15000

    def test_numeric_input(self):
        assert normalize_naira_price(5000) == 5000
        assert normalize_naira_price(0) is None

    def test_invalid(self):
        assert normalize_naira_price(None) is None
        assert normalize_naira_price("abc") is None
        assert normalize_naira_price("") is None

    def test_commas_stripped(self):
        assert normalize_naira_price("15,000") == 15000


class TestSanitizeSearchTerm:
    def test_strips_postgrest_breakers(self):
        # commas/parens/percent would corrupt the or= filter
        assert "," not in _sanitize_search_term("red, shoe (nice) 50%")
        assert "(" not in _sanitize_search_term("red, shoe (nice) 50%")
        assert "%" not in _sanitize_search_term("red, shoe (nice) 50%")

    def test_keeps_dots_for_sizes(self):
        assert _sanitize_search_term("size 4.5 shoe") == "size 4.5 shoe"

    def test_empty(self):
        assert _sanitize_search_term("") == ""
        assert _sanitize_search_term(None) == ""


class TestShouldExecute:
    def test_executes_with_action_even_if_data_empty(self):
        # list_products legitimately arrives with data == {}
        assert should_execute({"pending_action": "list_products", "collected_data": {}}) == "execute"

    def test_ends_without_action(self):
        assert should_execute({"pending_action": None, "collected_data": {}}) == "end"


class TestLlmWhitelists:
    def test_paid_not_llm_settable(self):
        assert "paid" not in ALLOWED_NEXT_STATES

    def test_identity_fields_not_updatable(self):
        assert "trader_id" not in ALLOWED_STATE_UPDATE_KEYS
        assert "order_id" not in ALLOWED_STATE_UPDATE_KEYS
        assert "delivery_details" in ALLOWED_STATE_UPDATE_KEYS

    def test_create_product_fields_bounded(self):
        assert "trader_id" not in CREATE_PRODUCT_FIELDS
        assert "name" in CREATE_PRODUCT_FIELDS


class TestSlimToolResults:
    def test_trims_product_fields(self):
        raw = {"results": [
            {"name": "X", "price": 100, "stock_quantity": 2, "description": "long", "image_url": "u"}
        ]}
        slim = _slim_tool_results(raw)
        assert slim["results"][0] == {"name": "X", "price": 100, "stock_quantity": 2}

    def test_passthrough_non_result(self):
        assert _slim_tool_results({"available": True}) == {"available": True}
        assert _slim_tool_results(None) is None


class TestTxRefParsing:
    def test_extracts_order_id(self):
        assert server._order_id_from_tx_ref("sharpshop_abc-123") == "abc-123"

    def test_rejects_foreign_ref(self):
        assert server._order_id_from_tx_ref("stripe_xyz") is None
        assert server._order_id_from_tx_ref("") is None
