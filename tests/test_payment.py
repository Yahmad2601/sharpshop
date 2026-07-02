"""Tests for check_order_status — the money-critical verification path.

Ensures a payment is only accepted when tx_ref, currency, and amount all match
the order (inline checkout lets the client control the charge, so status alone
must never be trusted).
"""
import pytest
import customer_tools


class FakeQuery:
    """Minimal chainable stand-in for the supabase-py query builder."""
    def __init__(self, rows):
        self._rows = rows
    def select(self, *a, **k): return self
    def eq(self, *a, **k): return self
    def execute(self):
        return type("R", (), {"data": self._rows, "count": len(self._rows)})()


class FakeSupabase:
    def __init__(self, orders):
        self._orders = orders
    def table(self, name):
        if name == "orders":
            return FakeQuery(self._orders)
        return FakeQuery([])


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload
    def json(self):
        return self._payload


ORDER = {"id": "order-1", "amount": 5000, "currency": "NGN", "status": "pending", "product_id": "p1", "trader_id": "t1"}


@pytest.fixture
def patched(monkeypatch):
    """Wire fake supabase + a spy for _mark_order_paid; caller sets the FW response."""
    calls = {"marked": []}
    monkeypatch.setattr(customer_tools, "get_supabase", lambda: FakeSupabase([dict(ORDER)]))
    monkeypatch.setattr(customer_tools, "_mark_order_paid", lambda order: calls["marked"].append(order["id"]))
    return calls, monkeypatch


def _set_fw(monkeypatch, payload):
    monkeypatch.setattr(customer_tools.requests, "get", lambda *a, **k: FakeResponse(payload))


def test_successful_matching_payment_marks_paid(patched):
    calls, monkeypatch = patched
    _set_fw(monkeypatch, {"status": "success", "data": {
        "status": "successful", "tx_ref": "sharpshop_order-1", "currency": "NGN", "amount": 5000,
    }})
    assert customer_tools.check_order_status("order-1") == "paid"
    assert calls["marked"] == ["order-1"]


def test_underpayment_rejected(patched):
    calls, monkeypatch = patched
    _set_fw(monkeypatch, {"status": "success", "data": {
        "status": "successful", "tx_ref": "sharpshop_order-1", "currency": "NGN", "amount": 100,
    }})
    assert customer_tools.check_order_status("order-1") == "pending"
    assert calls["marked"] == []  # never marked paid


def test_wrong_currency_rejected(patched):
    calls, monkeypatch = patched
    _set_fw(monkeypatch, {"status": "success", "data": {
        "status": "successful", "tx_ref": "sharpshop_order-1", "currency": "USD", "amount": 5000,
    }})
    assert customer_tools.check_order_status("order-1") == "pending"
    assert calls["marked"] == []


def test_mismatched_tx_ref_rejected(patched):
    calls, monkeypatch = patched
    _set_fw(monkeypatch, {"status": "success", "data": {
        "status": "successful", "tx_ref": "sharpshop_someone-else", "currency": "NGN", "amount": 5000,
    }})
    assert customer_tools.check_order_status("order-1") == "pending"
    assert calls["marked"] == []


def test_overpayment_accepted(patched):
    # Paying more than owed is fine (amount >= order amount)
    calls, monkeypatch = patched
    _set_fw(monkeypatch, {"status": "success", "data": {
        "status": "successful", "tx_ref": "sharpshop_order-1", "currency": "NGN", "amount": 9999,
    }})
    assert customer_tools.check_order_status("order-1") == "paid"


def test_unsuccessful_transaction_is_pending(patched):
    calls, monkeypatch = patched
    _set_fw(monkeypatch, {"status": "success", "data": {"status": "pending"}})
    assert customer_tools.check_order_status("order-1") == "pending"
    assert calls["marked"] == []


def test_already_paid_short_circuits(monkeypatch):
    paid_order = dict(ORDER, status="paid")
    monkeypatch.setattr(customer_tools, "get_supabase", lambda: FakeSupabase([paid_order]))
    # If it tried to call Flutterwave this would blow up — it must not.
    def boom(*a, **k):
        raise AssertionError("should not call Flutterwave for an already-paid order")
    monkeypatch.setattr(customer_tools.requests, "get", boom)
    assert customer_tools.check_order_status("order-1") == "paid"


def test_missing_order_returns_error(monkeypatch):
    monkeypatch.setattr(customer_tools, "get_supabase", lambda: FakeSupabase([]))
    assert customer_tools.check_order_status("nope") == "error"
