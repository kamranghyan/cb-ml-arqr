#!/usr/bin/env python3
"""
seed_admin.py — create the very first platform admin.

Chicken-and-egg: /auth/register requires a platform admin to call it, so the
first one has to be made outside the API. Run this once.

Usage:
    python seed_admin.py --email you@menulay.com --password 'StrongPass1!'
    python seed_admin.py --list          # show existing platform admins

Requires AWS credentials with cognito-idp admin permissions.
"""
import argparse
import sys

import boto3
from botocore.exceptions import ClientError

REGION = "ap-south-1"
USER_POOL_ID = "ap-south-1_SCyQ50etN"
GROUP = "menulay_admin"

cog = boto3.client("cognito-idp", region_name=REGION)


def list_admins() -> None:
    try:
        resp = cog.list_users_in_group(UserPoolId=USER_POOL_ID, GroupName=GROUP)
    except ClientError as e:
        sys.exit(f"Could not list admins: {e.response['Error']['Message']}")

    users = resp.get("Users", [])
    if not users:
        print("No platform admins yet.")
        return
    print(f"Platform admins ({len(users)}):")
    for u in users:
        attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
        tenant = attrs.get("custom:tenant_id", "")
        warn = "  ⚠ has tenant_id (should be empty)" if tenant else ""
        print(f"  {attrs.get('email', u['Username']):35} {u.get('UserStatus','')}{warn}")


def create_admin(email: str, password: str, name: str) -> None:
    attrs = [
        {"Name": "email", "Value": email},
        {"Name": "email_verified", "Value": "true"},
    ]
    if name:
        attrs.append({"Name": "custom:display_name", "Value": name})
    # Deliberately NO custom:tenant_id and NO custom:restaurant_id —
    # a platform admin is not bound to any company or branch.

    try:
        cog.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=attrs,
            MessageAction="SUPPRESS",
            TemporaryPassword=password,
        )
        cog.admin_set_user_password(
            UserPoolId=USER_POOL_ID, Username=email,
            Password=password, Permanent=True,
        )
        cog.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID, Username=email, GroupName=GROUP,
        )
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "UsernameExistsException":
            sys.exit(f"A user with email {email} already exists.")
        if code == "InvalidPasswordException":
            sys.exit("Password does not meet the pool's complexity rules "
                     "(needs upper, lower, number, symbol, 8+ chars).")
        sys.exit(f"Failed: {e.response['Error']['Message']}")

    print(f"✅ Platform admin created: {email}")
    print("   group        : menulay_admin")
    print("   tenant_id    : (none — correct for a platform admin)")
    print("   restaurant_id: (none)")
    print("\nLog in with these credentials to create tenants via POST /auth/register.")


def main() -> None:
    p = argparse.ArgumentParser(description="Create the first MenuLay platform admin")
    p.add_argument("--email")
    p.add_argument("--password")
    p.add_argument("--name", default="Platform Admin")
    p.add_argument("--list", action="store_true", help="list existing platform admins")
    a = p.parse_args()

    if a.list:
        list_admins()
        return

    if not a.email or not a.password:
        p.error("--email and --password are required (or use --list)")

    create_admin(a.email, a.password, a.name)


if __name__ == "__main__":
    main()
