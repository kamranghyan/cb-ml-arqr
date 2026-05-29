import json


def handler(event, context):
    http_method = event.get("httpMethod", "GET")
    path        = event.get("path", "")

    # POST /login
    if http_method == "POST" and "login" in path:
        return response(200, {
            "message":     "Login successful",
            "accessToken": "mock-access-token-abc123",
            "idToken":     "mock-id-token-xyz789",
            "expiresIn":   3600,
            "user": {
                "userId": "u001",
                "email":  "admin@mockrestaurant.com",
                "role":   "admin",
            }
        })

    # POST /logout
    if http_method == "POST" and "logout" in path:
        return response(200, {"message": "Logout successful"})

    # GET /me — returns current user
    if http_method == "GET" and "me" in path:
        return response(200, {
            "userId":   "u001",
            "email":    "admin@mockrestaurant.com",
            "role":     "admin",
            "tenantId": "t001",
        })

    return response(405, {"message": "Method not allowed"})


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type":                "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }
