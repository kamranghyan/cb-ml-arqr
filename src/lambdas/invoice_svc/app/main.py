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
    detail = event.get('detail', {})
    order_id = detail.get('orderId')
    amount = detail.get('amount', 0.0)
    tenant_id = detail.get('tenantId', '')

    if not order_id:
        print("Error: Missing orderId in event detail")
        return {"statusCode": 400, "body": json.dumps({"error": "Missing orderId"})}

    invoice_id = f"INV-{uuid.uuid4().hex[:8].upper()}"

    # 1. PDF Generation
    pdf_bytes = generate_invoice_pdf(invoice_id, order_id, amount)

    # 2. S3 Upload
    s3_key = f"invoices/{order_id}/{invoice_id}.pdf"
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=pdf_bytes,
        ContentType='application/pdf'
    )

    # 3. Presigned Link
    download_url = generate_presigned_url(s3_key)

    # 4. Save to DynamoDB
    item = {
        'invoiceId': invoice_id,
        'orderId': order_id,
        'tenantId': tenant_id,
        'amount': str(amount),
        's3Key': s3_key,
        'downloadUrl': download_url,
        'createdAt': datetime.datetime.utcnow().isoformat()
    }
    table.put_item(Item=item)
    return {"statusCode": 200, "body": json.dumps({"message": f"Invoice {invoice_id} created"})}


# Universal CORS Headers
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*", # ya aapka localhost URL
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Tenant-Id",
    "Access-Control-Allow-Methods": "GET,OPTIONS,POST"
}

def handle_get_invoice_api(event):
    try:
        query_parameters = event.get('queryStringParameters') or {}
        
        # Read from both camelCase and snake_case query params
        tenant_id = query_parameters.get('tenantId') or query_parameters.get('tenant_id')
        
        headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }

        if tenant_id:
            response = table.scan()
            raw_items = response.get('Items', [])
            
            # Casing safe filtering (checks both tenantId and tenant_id in DB items)
            items = [
                itm for itm in raw_items 
                if itm.get('tenantId') == tenant_id or itm.get('tenant_id') == tenant_id
            ]
            
            for itm in items:
                if 's3Key' in itm:
                    try:
                        itm['downloadUrl'] = generate_presigned_url(itm['s3Key'])
                    except Exception as e:
                        print(f"Error generating url: {e}")
            
            return {
                "statusCode": 200, 
                "headers": headers, 
                "body": json.dumps({"invoices": items})
            }

        return {
            "statusCode": 200, 
            "headers": headers, 
            "body": json.dumps({"invoices": []})
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": str(e)})
        }

def handler(event, context):
    print("Received Payload:", json.dumps(event))

    if "httpMethod" in event:
        return handle_get_invoice_api(event)
    elif event.get("source") == "app.payment_svc":
        return handle_payment_event(event)

    return {"statusCode": 400, "body": json.dumps({"error": "Unknown event source"})}