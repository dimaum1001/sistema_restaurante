"""Tests for cash session operations.

This module exercises the critical flows around opening and closing
cash sessions, as well as registering cash movements. It uses the
``seed_data`` fixture to create a manager user with both ``manager`` and
``cashier`` roles so that the user is authorised to perform cash
operations. The tests verify that a user cannot open two sessions
concurrently, that movements can be recorded against an open
session, and that the session can be closed with appropriate
permissions.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_open_close_cash_session(test_client: AsyncClient, seed_data):
    """A manager/cashier can open a cash session, register movements and close it."""
    # Log in as the manager user to obtain a JWT
    login_resp = await test_client.post(
        "/api/auth/login",
        json={"username": seed_data["manager_user"].username, "password": seed_data["manager_password"]},
    )
    assert login_resp.status_code == 200
    tokens = login_resp.json()
    access_token = tokens["access_token"]
    # Use the token for subsequent requests
    headers = {"Authorization": f"Bearer {access_token}"}
    # Open a cash session with R$100,00 as opening amount
    resp = await test_client.post(
        "/api/cash/sessions",
        json={"opening_amount": 100.0},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    session_data = resp.json()
    session_id = session_data["id"]
    assert session_data["is_open"] is True
    # Attempt to open a second session for the same user should fail
    resp2 = await test_client.post(
        "/api/cash/sessions",
        json={"opening_amount": 50.0},
        headers=headers,
    )
    assert resp2.status_code == 400
    assert "Sessão de caixa já aberta" in resp2.json()["detail"]
    # Register a cash movement (suprimento) of R$20,00
    move_resp = await test_client.post(
        "/api/cash/movements",
        json={"session_id": session_id, "type": "supply", "amount": 20.0, "reason": "Suprimento"},
        headers=headers,
    )
    assert move_resp.status_code == 200, move_resp.text
    movement = move_resp.json()
    assert movement["amount"] == 20.0
    assert movement["type"] == "supply"
    # Close the cash session
    close_resp = await test_client.post(
        f"/api/cash/sessions/{session_id}/close",
        json={"closing_amount": 120.0},
        headers=headers,
    )
    assert close_resp.status_code == 200, close_resp.text
    closed = close_resp.json()
    assert closed["is_open"] is False
    assert closed["closing_amount"] == 120.0