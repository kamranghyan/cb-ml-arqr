import json


def handler(event, context):
    http_method = event.get("httpMethod", "GET")

    if http_method == "GET":
        return response(200, {
            "orders": [
                {"orderId": "o001", "status": "pending",   "total": 15.97, "items": ["Burger", "Fries"]},
                {"orderId": "o002", "status": "completed", "total": 9.99,  "items": ["Burger"]},
            ]
        })

    if http_method == "POST":
        return response(201, {
            "message": "Order placed successfully",
            "orderId": "o003",
            "status":  "pending",
            "total":   13.98,
        })

    if http_method == "PUT":
        return response(200, {"message": "Order status updated", "status": "completed"})

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
