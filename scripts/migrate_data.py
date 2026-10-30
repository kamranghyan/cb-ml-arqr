#!/usr/bin/env python3
"""
Migrate data from single-table MenuTable-dev into the 5 normalized tables.

  MenuTable SK          →  target table
  METADATA              →  RestaurantTable-dev
  CATEGORY#<id>         →  CategoryTable-dev
  ITEM#<id>             →  ItemTable-dev
  TABLE#<id>            →  DiningTable-dev
  (Cognito tenants)     →  TenantTable-dev   (backfilled separately, see --tenants)

Safe: reads MenuTable, writes to new tables. Does NOT modify or delete MenuTable.
Idempotent: re-running overwrites the same records (PutItem by PK).

Usage:
  python migrate_data.py --dry-run     # show what WOULD be written, write nothing
  python migrate_data.py               # migrate restaurant/category/item/table
  python migrate_data.py --tenants     # ALSO backfill TenantTable from Cognito
  python migrate_data.py --verify      # count records in each new table
"""
import sys
import boto3
from boto3.dynamodb.conditions import Attr

REGION = "ap-south-1"
SRC = "MenuTable-dev"
USER_POOL_ID = "ap-south-1_SCyQ50etN"

# Only migrate this one real restaurant; skip all the test/junk data.
KEEP_RESTAURANT_ID = "eea190fd-b8dd-470d-aff1-7d75be5c2efb"

ddb = boto3.resource("dynamodb", region_name=REGION)
src = ddb.Table(SRC)

T = {
    "restaurant": ddb.Table("RestaurantTable-dev"),
    "category":   ddb.Table("CategoryTable-dev"),
    "item":       ddb.Table("ItemTable-dev"),
    "dining":     ddb.Table("DiningTable-dev"),
    "tenant":     ddb.Table("TenantTable-dev"),
}

# fields that belong only to the single-table layout — dropped on migration
DROP = {"PK", "SK", "version"}


def scan_all():
    items, kwargs = [], {}
    while True:
        resp = src.scan(**kwargs)
        items.extend(resp.get("Items", []))
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def clean(rec):
    return {k: v for k, v in rec.items() if k not in DROP}


def classify(rec):
    sk = rec.get("SK", "")
    if sk == "METADATA":
        return "restaurant"
    if sk.startswith("CATEGORY#"):
        return "category"
    if sk.startswith("ITEM#"):
        return "item"
    if sk.startswith("TABLE#"):
        return "dining"
    return None


def migrate(dry):
    rows = scan_all()
    print(f"Scanned {len(rows)} records from {SRC}\n")
    counts = {"restaurant": 0, "category": 0, "item": 0, "dining": 0, "skipped": 0}
    for rec in rows:
        kind = classify(rec)
        if not kind:
            counts["skipped"] += 1
            continue

        # ── filter: keep ONLY the real Cheezious restaurant + its children ──
        if kind == "restaurant":
            if rec.get("restaurantId") != KEEP_RESTAURANT_ID:
                counts["skipped"] += 1
                continue
        else:  # category / item / dining must belong to that restaurant
            if rec.get("restaurantId") != KEEP_RESTAURANT_ID:
                counts["skipped"] += 1
                continue

        body = clean(rec)
        # ensure the PK attribute exists for each target
        pk = {"restaurant": "restaurantId", "category": "categoryId",
              "item": "itemId", "dining": "tableId"}[kind]
        if pk not in body:
            print(f"  ! {kind} missing {pk}, skipping: {rec.get('SK')}")
            counts["skipped"] += 1
            continue
        if dry:
            print(f"  [{kind}] {body.get(pk)}  {body.get('name','')}")
        else:
            T[kind].put_item(Item=body)
        counts[kind] += 1
    print("\nSummary:", counts)
    if dry:
        print("\n(dry-run — nothing written)")


def backfill_tenants(dry):
    """Create TenantTable records from Cognito tenant users."""
    cog = boto3.client("cognito-idp", region_name=REGION)
    users, kwargs = [], {"UserPoolId": USER_POOL_ID}
    while True:
        resp = cog.list_users(**kwargs)
        users.extend(resp.get("Users", []))
        tok = resp.get("PaginationToken")
        if not tok:
            break
        kwargs["PaginationToken"] = tok

    seen = {}
    for u in users:
        attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
        tenant_id = attrs.get("custom:tenant_id")
        rest_id = attrs.get("custom:restaurant_id")
        groups_ok = True  # can't read groups from list_users cheaply; keep all with tenant_id
        if not tenant_id:
            continue
        # multiple users share the same tenant_id in the old data — collapse them.
        seen.setdefault(tenant_id, []).append(attrs.get("email", ""))

    if len(seen) == 0:
        print("  (no users with custom:tenant_id found)")
    for tid, emails in seen.items():
        if len(emails) > 1:
            print(f"  ⚠ tenant_id {tid} is shared by {len(emails)} users: {emails}")
            print(f"    → NOT auto-writing (ambiguous). Create real tenants via auth_svc later.")
            continue
        rec = {"tenantId": tid, "restaurantId": "", "email": emails[0],
               "name": "", "isActive": True}
        if dry:
            print(f"  [tenant] {tid} ({emails[0]})")
        else:
            T["tenant"].put_item(Item=rec)

    print("\nNOTE: Existing users share one tenant_id and have no restaurant link.")
    print("Real tenant→restaurant records will be created in Step 6 (auth_svc),")
    print("when admin registers a proper tenant for a restaurant.")


def verify():
    for name, tbl in T.items():
        c = tbl.scan(Select="COUNT")["Count"]
        print(f"  {tbl.name}: {c} items")


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else "migrate"
    if arg == "--verify":
        verify()
    elif arg == "--tenants":
        backfill_tenants(dry=False)
    elif arg == "--dry-run":
        migrate(dry=True)
        print("\n--- tenant backfill preview ---")
        backfill_tenants(dry=True)
    else:
        migrate(dry=False)
        print("\nRun 'python migrate_data.py --tenants' to backfill TenantTable.")
        print("Run 'python migrate_data.py --verify' to check counts.")


if __name__ == "__main__":
    main()