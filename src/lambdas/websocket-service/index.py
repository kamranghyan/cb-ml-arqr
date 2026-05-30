import json


def handler(event, context):
    connection_id = event.get("requestContext", {}).get("connectionId", "mock-conn-001")

    print(f"WebSocket CONNECT — connectionId: {connection_id}")

    # In real implementation:
    # - Save connectionId to DynamoDB ConnectionTable
    # - Associate with tenantId from query params

    return {
        "statusCode": 200,
        "body":       json.dumps({
            "message":      "Connected successfully",
            "connectionId": connection_id,
        })
    }
