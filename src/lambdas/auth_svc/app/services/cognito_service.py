"""
app.services.cognito_service
============================
All Cognito *write* operations live here — creating users, setting passwords,
assigning groups, login and refresh.

This is the only place in the platform with Cognito admin permissions;
every other service merely *verifies* tokens via shared/cognito_auth.py.
"""
from __future__ import annotations

import boto3
from botocore.exceptions import ClientError

from shared.exceptions import BadRequestError, ResourceNotFoundError, StorageError
from shared.structured_logger import get_logger

from app.core.config import get_settings

log = get_logger("auth.cognito")
_settings = get_settings()


class InvalidCredentialsError(BadRequestError):
    """Login failed — wrong email/password, or an unusable refresh token."""
    error_code  = "INVALID_CREDENTIALS"
    http_status = 401


class CognitoService:
    def __init__(self, client=None) -> None:
        self._c = client or boto3.client("cognito-idp", region_name=_settings.cognito_region)
        self._pool = _settings.cognito_user_pool_id
        self._client_id = _settings.cognito_client_id

    # ── Authentication ────────────────────────────────────────────────

    def login(self, email: str, password: str) -> dict:
        """USER_PASSWORD_AUTH login. Returns the raw AuthenticationResult."""
        try:
            resp = self._c.initiate_auth(
                ClientId=self._client_id,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={"USERNAME": email, "PASSWORD": password},
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("NotAuthorizedException", "UserNotFoundException"):
                raise InvalidCredentialsError("Incorrect email or password") from exc
            if code == "UserNotConfirmedException":
                raise InvalidCredentialsError("Account not confirmed") from exc
            log.error("cognito.login.failed", error=code)
            raise StorageError("Login failed") from exc

        if "AuthenticationResult" not in resp:
            # e.g. NEW_PASSWORD_REQUIRED challenge
            raise InvalidCredentialsError(
                f"Additional challenge required: {resp.get('ChallengeName', 'unknown')}"
            )
        return resp["AuthenticationResult"]

    def refresh(self, refresh_token: str) -> dict:
        try:
            resp = self._c.initiate_auth(
                ClientId=self._client_id,
                AuthFlow="REFRESH_TOKEN_AUTH",
                AuthParameters={"REFRESH_TOKEN": refresh_token},
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "NotAuthorizedException":
                raise InvalidCredentialsError("Refresh token is invalid or expired") from exc
            raise StorageError("Token refresh failed") from exc
        return resp["AuthenticationResult"]

    # ── User management ───────────────────────────────────────────────

    def create_user(
        self,
        email: str,
        password: str,
        group: str,
        name: str = "",
        tenant_id: str = "",
        restaurant_id: str = "",
    ) -> str:
        """
        Create a confirmed Cognito user with a permanent password and put it
        in `group`. Returns the user's sub.

        Custom attributes are only set when non-empty — a platform admin gets
        neither tenant nor restaurant, a tenant owner gets tenant only.
        """
        attrs = [
            {"Name": "email", "Value": email},
            {"Name": "email_verified", "Value": "true"},
        ]
        if name:
            attrs.append({"Name": "custom:display_name", "Value": name})
        if tenant_id:
            attrs.append({"Name": "custom:tenant_id", "Value": tenant_id})
        if restaurant_id:
            attrs.append({"Name": "custom:restaurant_id", "Value": restaurant_id})

        try:
            created = self._c.admin_create_user(
                UserPoolId=self._pool,
                Username=email,
                UserAttributes=attrs,
                MessageAction="SUPPRESS",       # no invite email; admin shares creds
                TemporaryPassword=password,
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "UsernameExistsException":
                raise BadRequestError(f"A user with email {email} already exists") from exc
            if code == "InvalidPasswordException":
                raise BadRequestError(
                    "Password does not meet the pool's complexity requirements"
                ) from exc
            log.error("cognito.create_user.failed", error=code, email=email)
            raise StorageError("Could not create user") from exc

        sub = next(
            (a["Value"] for a in created["User"]["Attributes"] if a["Name"] == "sub"),
            "",
        )

        # Make the password permanent so the user is not stuck on a challenge.
        try:
            self._c.admin_set_user_password(
                UserPoolId=self._pool, Username=email, Password=password, Permanent=True
            )
            self._c.admin_add_user_to_group(
                UserPoolId=self._pool, Username=email, GroupName=group
            )
        except ClientError as exc:
            # Roll back the half-created user so a retry can succeed.
            log.error("cognito.create_user.post_step_failed",
                      error=exc.response["Error"]["Code"], email=email)
            try:
                self._c.admin_delete_user(UserPoolId=self._pool, Username=email)
            except ClientError:
                pass
            raise StorageError("Could not finish creating user") from exc

        log.info("cognito.user.created", email=email, group=group,
                 tenant_id=tenant_id, restaurant_id=restaurant_id)
        return sub

    def delete_user(self, username: str) -> None:
        try:
            self._c.admin_delete_user(UserPoolId=self._pool, Username=username)
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "UserNotFoundException":
                raise ResourceNotFoundError("User", username) from exc
            raise StorageError("Could not delete user") from exc
        log.info("cognito.user.deleted", username=username)

    def set_user_enabled(self, username: str, enabled: bool) -> None:
        try:
            if enabled:
                self._c.admin_enable_user(UserPoolId=self._pool, Username=username)
            else:
                self._c.admin_disable_user(UserPoolId=self._pool, Username=username)
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "UserNotFoundException":
                raise ResourceNotFoundError("User", username) from exc
            raise StorageError("Could not update user status") from exc

    def list_users(self, tenant_id: str = "") -> list[dict]:
        """List users, optionally filtered to one tenant (client-side filter)."""
        users, kwargs = [], {"UserPoolId": self._pool, "Limit": 60}
        while True:
            try:
                resp = self._c.list_users(**kwargs)
            except ClientError as exc:
                raise StorageError("Could not list users") from exc
            for u in resp.get("Users", []):
                attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
                if tenant_id and attrs.get("custom:tenant_id") != tenant_id:
                    continue
                users.append({
                    "username":     u["Username"],
                    "email":        attrs.get("email", ""),
                    "name":         attrs.get("custom:display_name", ""),
                    "tenantId":     attrs.get("custom:tenant_id", ""),
                    "restaurantId": attrs.get("custom:restaurant_id", ""),
                    "enabled":      u.get("Enabled", True),
                    "status":       u.get("UserStatus", ""),
                })
            token = resp.get("PaginationToken")
            if not token:
                break
            kwargs["PaginationToken"] = token
        return users

    def get_user_groups(self, username: str) -> list[str]:
        try:
            resp = self._c.admin_list_groups_for_user(
                UserPoolId=self._pool, Username=username
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "UserNotFoundException":
                raise ResourceNotFoundError("User", username) from exc
            raise StorageError("Could not read user groups") from exc
        return [g["GroupName"] for g in resp.get("Groups", [])]
