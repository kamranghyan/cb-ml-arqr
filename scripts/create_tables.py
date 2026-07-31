#!/usr/bin/env python3
"""
Create the 5 normalized MenuLay tables (dev) with their GSIs.

Usage:
    python create_tables.py            # create all
    python create_tables.py --check    # only report existence, create nothing
    python create_tables.py --delete   # DANGER: delete all 5 (for a clean re-run)

Requires: boto3, AWS creds with dynamodb:CreateTable/DescribeTable.
Region: ap-south-1
"""
import sys
import time
import boto3
from botocore.exceptions import ClientError

REGION = "ap-south-1"
ddb = boto3.client("dynamodb", region_name=REGION)

BILLING = "PAY_PER_REQUEST"  # on-demand — no capacity planning needed for dev


def S(name):
    return {"AttributeName": name, "AttributeType": "S"}


def N(name):
    return {"AttributeName": name, "AttributeType": "N"}


# ── Table definitions ─────────────────────────────────────────────────────────

TABLES = {
    "RestaurantTable-dev": {
        "KeySchema": [{"AttributeName": "restaurantId", "KeyType": "HASH"}],
        "AttributeDefinitions": [S("restaurantId"), S("tenantId")],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "tenantId-index",
                "KeySchema": [{"AttributeName": "tenantId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
    },

    "CategoryTable-dev": {
        "KeySchema": [{"AttributeName": "categoryId", "KeyType": "HASH"}],
        "AttributeDefinitions": [S("categoryId"), S("restaurantId"), N("displayOrder")],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "restaurantId-index",
                "KeySchema": [
                    {"AttributeName": "restaurantId", "KeyType": "HASH"},
                    {"AttributeName": "displayOrder", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
    },

    "ItemTable-dev": {
        "KeySchema": [{"AttributeName": "itemId", "KeyType": "HASH"}],
        "AttributeDefinitions": [S("itemId"), S("restaurantId"), S("categoryId")],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "restaurantId-index",
                "KeySchema": [{"AttributeName": "restaurantId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "categoryId-index",
                "KeySchema": [{"AttributeName": "categoryId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
    },

    "DiningTable-dev": {
        "KeySchema": [{"AttributeName": "tableId", "KeyType": "HASH"}],
        "AttributeDefinitions": [S("tableId"), S("restaurantId")],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "restaurantId-index",
                "KeySchema": [{"AttributeName": "restaurantId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
    },

    "TenantTable-dev": {
        "KeySchema": [{"AttributeName": "tenantId", "KeyType": "HASH"}],
        "AttributeDefinitions": [S("tenantId"), S("restaurantId")],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "restaurantId-index",
                "KeySchema": [{"AttributeName": "restaurantId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
    },
}


def exists(name):
    try:
        ddb.describe_table(TableName=name)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            return False
        raise


def create(name, spec):
    if exists(name):
        print(f"  = {name} already exists — skipping")
        return
    print(f"  + creating {name} ...")
    ddb.create_table(
        TableName=name,
        BillingMode=BILLING,
        KeySchema=spec["KeySchema"],
        AttributeDefinitions=spec["AttributeDefinitions"],
        GlobalSecondaryIndexes=spec.get("GlobalSecondaryIndexes", []),
    )


def wait_active(name):
    print(f"  ... waiting for {name} to become ACTIVE")
    ddb.get_waiter("table_exists").wait(TableName=name)


def delete(name):
    if not exists(name):
        print(f"  = {name} not present")
        return
    print(f"  - deleting {name}")
    ddb.delete_table(TableName=name)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "create"

    if mode == "--check":
        print("Existence check:")
        for name in TABLES:
            print(f"  {'✅' if exists(name) else '❌'} {name}")
        return

    if mode == "--delete":
        confirm = input("DELETE all 5 tables? type 'yes': ")
        if confirm.strip() != "yes":
            print("aborted")
            return
        for name in TABLES:
            delete(name)
        print("delete requested (tables drain in background)")
        return

    print("Creating tables (on-demand billing):")
    for name, spec in TABLES.items():
        create(name, spec)
    print("\nWaiting for all to be ACTIVE ...")
    for name in TABLES:
        wait_active(name)
    print("\n✅ All 5 tables ready.")
    for name in TABLES:
        d = ddb.describe_table(TableName=name)["Table"]
        gsis = [g["IndexName"] for g in d.get("GlobalSecondaryIndexes", [])]
        print(f"  {name}: PK={d['KeySchema'][0]['AttributeName']}, GSIs={gsis}")


if __name__ == "__main__":
    main()