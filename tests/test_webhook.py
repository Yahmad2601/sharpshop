"""Tests for the Flutterwave webhook: auth + re-verify-don't-trust behavior."""
import pytest
from fastapi.testclient import TestClient

import server
import customer_tools
import customer_config

SECRET = "test-secret-hash"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(customer_config, "FLUTTERWAVE_SECRET_HASH", SECRET)
    # Don't hit Flutterwave/DB: record which order the webhook re-verified.
    calls = {"verified": []}
    def fake_check(order_id):
        calls["verified"].append(order_id)
        return "paid"
    monkeypatch.setattr(customer_tools, "check_order_status", fake_check)
    c = TestClient(server.app)
    c._calls = calls
    return c


def test_missing_hash_rejected(client):
    r = client.post("/api/webhook/flutterwave", json={"data": {"tx_ref": "sharpshop_x"}})
    assert r.status_code == 401
    assert client._calls["verified"] == []


def test_wrong_hash_rejected(client):
    r = client.post("/api/webhook/flutterwave",
                    headers={"verif-hash": "nope"},
                    json={"data": {"tx_ref": "sharpshop_x"}})
    assert r.status_code == 401
    assert client._calls["verified"] == []


def test_foreign_tx_ref_ignored(client):
    # Valid auth but not our reference — ack with 200 so FW stops retrying,
    # and never trigger verification.
    r = client.post("/api/webhook/flutterwave",
                    headers={"verif-hash": SECRET},
                    json={"data": {"tx_ref": "someone_else_ref"}})
    assert r.status_code == 200
    assert client._calls["verified"] == []


def test_valid_webhook_triggers_reverification(client):
    r = client.post("/api/webhook/flutterwave",
                    headers={"verif-hash": SECRET},
                    json={"data": {"tx_ref": "sharpshop_order-42", "status": "successful"}})
    assert r.status_code == 200
    # It re-verified via check_order_status rather than trusting the body
    assert client._calls["verified"] == ["order-42"]
    assert r.json()["status"] == "paid"


def test_secret_hash_unset_rejects(monkeypatch):
    monkeypatch.setattr(customer_config, "FLUTTERWAVE_SECRET_HASH", "")
    monkeypatch.setattr(customer_tools, "check_order_status", lambda o: "paid")
    c = TestClient(server.app)
    r = c.post("/api/webhook/flutterwave",
               headers={"verif-hash": "anything"},
               json={"data": {"tx_ref": "sharpshop_x"}})
    assert r.status_code == 401
