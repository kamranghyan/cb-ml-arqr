import os
import json
import uuid
import datetime
import boto3
from boto3.dynamodb.conditions import Key
from app.pdf_generator import generate_invoice_pdf

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

TABLE_NAME = os.environ.get('INVOICES_TABLE_NAME')
BUCKET_NAME = os.environ.get('INVOICES_BUCKET_NAME')

table = dynamodb.Table(TABLE_NAME)

def generate_presigned_url(s3_key: str, expiration: int = 86400) -> str:
    """Generates a pre-signed URL to download the invoice PDF directly from S3 (valid for 24h)"""
    return s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET_NAME, 'Key': s3_key},
        ExpiresIn=expiration
    )

def handle_payment_event(event):
    """Processes 'payment.succeeded' event from EventBridge"""
    detail = event.get('detail', {})
    
    # Support both snake_case and camelCase
    order_id = detail.get('order_id') or detail.get('orderId')
    amount = detail.get('amount', 0.0)
    
    if not order_id:
        print("Error: Missing order_id in event detail")
        return {"statusCode": 400, "body": json.dumps({"error": "Missing order_id"})}
    
    invoice_id = f"INV-{uuid.uuid4().hex[:8].upper()}"
    
    # 1. Generate PDF
    pdf_bytes = generate_invoice_pdf(invoice_id, order_id, amount)
    
    # 2. Upload PDF to S3
    s3_key = f"invoices/{order_id}/{invoice_id}.pdf"
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=pdf_bytes,
        ContentType='application/pdf'
    )
    
    # 3. Generate Pre-signed Download Link
    download_url = generate_presigned_url(s3_key)
    
    # 4. Save to DynamoDB
    item = {
        'invoiceId': invoice_id,
        'orderId': order_id,
        'amount': str(amount),
        's3Key': s3_key,
        'downloadUrl': download_url,
        'createdAt': datetime.datetime.utcnow().isoformat()
    }
    table.put_item(Item=item)
    print(f"Invoice {invoice_id} successfully created for Order {order_id}")
    return {"statusCode": 200, "body": json.dumps({"message": f"Invoice {invoice_id} created"})}

def handle_get_invoice_api(event):
    """API Endpoint to fetch invoice details and download link by orderId"""
    path_parameters = event.get('pathParameters') or {}
    order_id = path_parameters.get('orderId')
    
    if not order_id:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "orderId parameter is required"})
        }
    
    # Query DynamoDB GSI (OrderIdIndex)
    response = table.query(
        IndexName='OrderIdIndex',
        KeyConditionExpression=Key('orderId').eq(order_id)
    )
    
    items = response.get('Items', [])
    if not items:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Invoice not found for this orderId"})
        }
    
    invoice = items[0]
    
    # Fresh pre-signed URL refresh (if link expired)
    invoice['downloadUrl'] = generate_presigned_url(invoice['s3Key'])
    
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(invoice)
    }

def handler(event, context):
    print("Received Payload:", json.dumps(event))
    
    # Route request: API Gateway vs EventBridge Event
    if "httpMethod" in event:
        return handle_get_invoice_api(event)
    elif event.get("source") == "app.payment_svc":
        return handle_payment_event(event)
    
    return {"statusCode": 400, "body": json.dumps({"error": "Unknown event source"})}