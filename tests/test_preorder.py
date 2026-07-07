"""Tests for the pre-order/"drop" model: deadline parsing and creation rules."""
from datetime import datetime, timedelta, timezone

from customer_tools import parse_deadline, deadline_passed
import tools


class TestParseDeadline:
    def test_iso_with_offset(self):
        dt = parse_deadline("2026-07-09T21:00:00+01:00")
        assert dt is not None and dt.utcoffset() == timedelta(hours=1)

    def test_iso_z_suffix(self):
        dt = parse_deadline("2026-07-09T20:00:00Z")
        assert dt is not None and dt.utcoffset() == timedelta(0)

    def test_naive_assumed_lagos(self):
        dt = parse_deadline("2026-07-09T21:00:00")
        assert dt is not None and dt.utcoffset() == timedelta(hours=1)

    def test_garbage(self):
        assert parse_deadline("thursday night") is None
        assert parse_deadline(None) is None
        assert parse_deadline("") is None


class TestDeadlinePassed:
    def test_future_not_passed(self):
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        assert deadline_passed(future) is False

    def test_past_is_passed(self):
        past = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        assert deadline_passed(past) is True

    def test_no_deadline_never_passed(self):
        assert deadline_passed(None) is False
        assert deadline_passed("not-a-date") is False


class TestPreorderCreationRules:
    BASE = dict(
        name="Red Velvet Cupcakes", price=2000, category="Food & Drinks", stock=0,
        trader_id="t1", trader_name="Bakes", whatsapp_number="+2348000000000",
        image="https://example.com/c.jpg", is_preorder=True,
    )

    def test_requires_deadline_and_capacity(self):
        res = tools.create_product(**self.BASE)
        assert res["success"] is False
        assert "deadline" in res["error"].lower() or "capacity" in res["error"].lower()

    def test_rejects_past_deadline(self):
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        res = tools.create_product(**self.BASE, order_deadline=past, max_capacity=50)
        assert res["success"] is False
        assert "past" in res["error"].lower()

    def test_rejects_bad_capacity(self):
        future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        res = tools.create_product(**self.BASE, order_deadline=future, max_capacity=0)
        assert res["success"] is False

    def test_valid_drop_sets_stock_to_capacity(self, monkeypatch):
        inserted = {}

        class FakeTable:
            def insert(self, data):
                inserted.update(data)
                return self
            def execute(self):
                return type("R", (), {"data": [dict(inserted, id="p1")]})()

        class FakeSupabase:
            def table(self, name):
                return FakeTable()

        monkeypatch.setattr(tools, "get_supabase", lambda: FakeSupabase())
        future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        res = tools.create_product(**self.BASE, order_deadline=future, max_capacity=50)
        assert res["success"] is True
        # Remaining slots ride on stock_quantity, initialized to capacity
        assert inserted["stock_quantity"] == 50
        assert inserted["is_preorder"] is True
        assert inserted["max_capacity"] == 50
        assert inserted["order_deadline"] is not None

    def test_regular_product_untouched(self, monkeypatch):
        inserted = {}

        class FakeTable:
            def insert(self, data):
                inserted.update(data)
                return self
            def execute(self):
                return type("R", (), {"data": [dict(inserted, id="p2")]})()

        class FakeSupabase:
            def table(self, name):
                return FakeTable()

        monkeypatch.setattr(tools, "get_supabase", lambda: FakeSupabase())
        base = dict(self.BASE, is_preorder=False, stock=5)
        res = tools.create_product(**base)
        assert res["success"] is True
        assert inserted["stock_quantity"] == 5
        assert inserted["is_preorder"] is False
        assert inserted["order_deadline"] is None
