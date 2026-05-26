import json

def lambda_handler(event, context):
    return {
        "statusCode": 200,
        "body": json.dumps([
            {"id": 101, "item": "Laptop"}
        ])
    }