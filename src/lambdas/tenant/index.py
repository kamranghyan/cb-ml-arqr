import json


def handler(event, context):
    http_method = event.get("httpMethod", "GET")

    if http_method == "GET":
        return response(200, {
            "tenants": [
                {"tenantId": "t001", "slug": "mock-restaurant-1", "name": "Mock Restaurant 1", "active": True},
                {"tenantId": "t002", "slug": "mock-restaurant-2", "name": "Mock Restaurant 2", "active": True},
            ]
        })

    if http_method == "POST":
        return response(201, {
            "message":  "Tenant created successfully",
            "tenantId": "t003",
            "slug":     "new-restaurant",
        })

    if http_method == "PUT":
        return response(200, {"message": "Tenant updated successfully"})

    if http_method == "DELETE":
        return response(200, {"message": "Tenant deactivated"})

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
