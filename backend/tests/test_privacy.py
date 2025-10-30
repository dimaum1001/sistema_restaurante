"""Tests for LGPD compliance: consent registration, data export and deletion.

These tests verify that the privacy endpoints allow registering a
consent for a customer, exporting their data in a zipped JSON and
deleting/anonymising the customer on request. After deletion the
personal fields should be nulled and an audit log should be created.
"""

import json
import zipfile
from io import BytesIO

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models.customer import Customer, AuditLog


@pytest.mark.asyncio
async def test_lgpd_consents_export_delete(test_client: AsyncClient, seed_data, db_session: Session):
    """End‑to‑end LGPD flow: register consent, export data and delete the customer."""
    # Authenticate as manager
    login_resp = await test_client.post(
        "/api/auth/login",
        json={"username": seed_data["manager_user"].username, "password": seed_data["manager_password"]},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    # Create a customer
    cust_resp = await test_client.post(
        "/api/customers",
        json={"name": "José da Silva", "phone": "+5511999998888", "email": "jose@example.com"},
        headers=headers,
    )
    assert cust_resp.status_code == 200, cust_resp.text
    customer_id = cust_resp.json()["id"]
    # Register a marketing consent using the privacy endpoint
    consent_resp = await test_client.post(
        f"/api/privacy/consents?customer_id={customer_id}",
        json={"purpose": "marketing"},
        headers=headers,
    )
    assert consent_resp.status_code == 200, consent_resp.text
    # Export the customer's data
    export_resp = await test_client.get(
        f"/api/privacy/export/{customer_id}",
        headers=headers,
    )
    assert export_resp.status_code == 200
    # The response is a zip archive containing a single JSON file
    zip_bytes = export_resp.content
    with zipfile.ZipFile(BytesIO(zip_bytes), mode="r") as zf:
        # Expect exactly one file in the archive
        names = zf.namelist()
        assert len(names) == 1
        data_json = zf.read(names[0])
        data = json.loads(data_json.decode("utf-8"))
    # Verify exported fields
    assert data["customer"]["name"] == "José da Silva"
    assert any(cons["purpose"] == "marketing" for cons in data["customer"]["consents"])
    # Delete (anonymise) the customer
    delete_resp = await test_client.post(
        f"/api/privacy/delete/{customer_id}",
        json={"reason": "Solicitação do titular"},
        headers=headers,
    )
    assert delete_resp.status_code == 200
    # Query the customer again in the DB to verify anonymisation
    cust = db_session.query(Customer).filter(Customer.id == customer_id, Customer.tenant_id == seed_data["tenant_id"]).first()
    assert cust is not None
    assert cust.name is None
    assert cust.phone is None
    assert cust.email is None
    assert cust.deleted_at is not None
    # An audit log should be recorded
    logs = db_session.query(AuditLog).filter(AuditLog.entity == "customer", AuditLog.entity_id == customer_id).all()
    assert len(logs) == 1
    assert logs[0].action == "delete_customer"