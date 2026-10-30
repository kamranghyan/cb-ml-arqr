"""
Verifies that cancelling an order persists `cancellationReason` to DynamoDB,
and that non-cancel status updates never write that field.

Uses moto to mock DynamoDB — run with:
    pip install -r requirements.txt -r requirements-dev.txt
    pytest tests/test_cancellation_reason.py -v
"""
import boto3
import pytest
from moto import mock_aws

from app.repositories.order_repository import OrderRepository

TABLE_NAME = "OrderTable-test"


@pytest.fixture
def order_table():
    with mock_aws():
        resource = boto3.resource("dynamodb", region_name="ap-south-1")
        resource.create_table(
            TableName=TABLE_NAME,
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
                {"AttributeName": "restaurantId", "AttributeType": "S"},
                {"AttributeName": "placedAt", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            GlobalSecondaryIndexes=[{
                "IndexName": "GSI-1-restaurant-orders",
                "KeySchema": [
                    {"AttributeName": "restaurantId", "KeyType": "HASH"},
                    {"AttributeName": "placedAt", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }],
            BillingMode="PAY_PER_REQUEST",
        )
        yield resource.Table(TABLE_NAME)


@pytest.fixture
def repo(order_table):
    client = boto3.client("dynamodb", region_name="ap-south-1")
    resource = boto3.resource("dynamodb", region_name="ap-south-1")
    return OrderRepository(
        dynamodb_resource=resource,
        dynamodb_client=client,
        table_name=TABLE_NAME,
    )


def _seed_order(table, tenant_id, order_id, restaurant_id="r1"):
    table.put_item(Item={
        "PK": f"TENANT#{tenant_id}#ORDER#{order_id}",
        "SK": "STATUS#2026-09-10T10:00:00Z",
        "orderId": order_id,
        "tenantId": tenant_id,
        "restaurantId": restaurant_id,
        "placedAt": "2026-09-10T10:00:00Z",
        "status": "RECEIVED",
        "updatedAt": "2026-09-10T10:00:00Z",
        "lineItems": [],
    })


def test_cancel_persists_reason(order_table, repo):
    _seed_order(order_table, "tenant-1", "order-1")

    repo.update_status(
        "order-1",
        "tenant-1",
        "CANCELLED",
        cancellation_reason="Ordered by mistake, wrong table",
    )

    order = repo.get_order("order-1", "tenant-1")
    assert order["status"] == "CANCELLED"
    assert order["cancellationReason"] == "Ordered by mistake, wrong table"


def test_non_cancel_update_does_not_write_reason(order_table, repo):
    _seed_order(order_table, "tenant-1", "order-2")

    repo.update_status("order-2", "tenant-1", "PREPARING", cancellation_reason=None)

    order = repo.get_order("order-2", "tenant-1")
    assert order["status"] == "PREPARING"
    assert "cancellationReason" not in order


def test_cancel_without_reason_still_cancels(order_table, repo):
    """A cancel with no reason text should still cancel; it just won't add the field."""
    _seed_order(order_table, "tenant-1", "order-3")

    repo.update_status("order-3", "tenant-1", "CANCELLED", cancellation_reason=None)

    order = repo.get_order("order-3", "tenant-1")
    assert order["status"] == "CANCELLED"
    assert "cancellationReason" not in order
