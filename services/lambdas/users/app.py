import json

def lambda_handler(event, context):
    return {
        "statusCode": 200,
        "body": json.dumps([
            {"id": 1, "name": "Ali"},
            {"id": 2, "name": "Sara"}
        ])
    }