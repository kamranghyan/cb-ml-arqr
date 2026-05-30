import json


def handler(event, context):
    http_method = event.get("httpMethod", "GET")

    if http_method == "GET":
        return response(200, {
            "restaurantId": "r001",
            "restaurantName": "Mock Restaurant",
            "items": [
                {"itemId": "i001", "name": "Burger",    "price": 9.99,  "category": "Main"},
                {"itemId": "i002", "name": "Fries",     "price": 3.99,  "category": "Side"},
                {"itemId": "i003", "name": "Coca Cola", "price": 1.99,  "category": "Drink"},
            ]
        })

    if http_method == "POST":
        return response(201, {"message": "Menu item created", "itemId": "i004"})

    if http_method == "PUT":
        return response(200, {"message": "Menu item updated"})

    if http_method == "DELETE":
        return response(200, {"message": "Menu item deleted"})

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
