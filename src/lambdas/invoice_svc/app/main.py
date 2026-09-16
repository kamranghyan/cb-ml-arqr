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
    order_id = detail.get('order_id') or detail.get('orderId')
    amount = detail.get('amount', 0.0)
    tenant_id = detail.get('tenant_id') or detail.get('tenantId', '')
    currency = detail.get('currency', 'PKR')
    plan_id = detail.get('plan_id') or detail.get('planId', '')
    payment_id = detail.get('payment_id') or detail.get('transaction_id', '')
    # Genuinely dynamic — read whatever pay_svc actually recorded for this
    # transaction. "EasyPaisa" is only a last-resort default for events
    # that somehow arrive without it (e.g. an older event format) — it is
    # NOT the primary source. When pay_svc adds a new payment path, that
    # code sets its own payment_method and this line needs no changes.
    payment_method = detail.get('payment_method') or 'EasyPaisa'


    if not order_id:
        print("Error: Missing orderId in event detail")
        return {"statusCode": 400, "body": json.dumps({"error": "Missing orderId"})}

    invoice_id = f"INV-{uuid.uuid4().hex[:8].upper()}"

    # 1. PDF Generation
    pdf_bytes = generate_invoice_pdf(
    invoice_id,
    order_id,
    amount,
    currency
)

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
    now_iso = datetime.datetime.utcnow().isoformat()

    # 4. Save to DynamoDB
    item = {
        'invoiceId': invoice_id,
        'orderId': order_id,
        'tenantId': tenant_id,
        'amount': str(amount),
        'currency': currency,
        'planId': plan_id,
        'paymentId': payment_id,
        # This handler only ever fires on payment.succeeded — no
        # "pending"/"failed" event reaches invoice_svc — so every
        # invoice that gets created here is, by definition, already paid.
        'paymentMethod': payment_method,
        'status': 'PAID',
        'paidAt': now_iso,
        's3Key': s3_key,
        'downloadUrl': download_url,
        'createdAt': datetime.datetime.utcnow().isoformat(),
        'createdAt': now_iso
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
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS,POST",
    }

    try:
        # =====================================================
        # 1. OPTIONS / CORS
        # =====================================================

        if event.get("httpMethod") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({"message": "OK"}),
            }

        # =====================================================
        # 2. Read request information
        # =====================================================

        path = event.get("path", "")
        path_parameters = event.get("pathParameters") or {}
        query_parameters = event.get("queryStringParameters") or {}

        invoice_id = path_parameters.get("invoiceId")

        tenant_id = (
            query_parameters.get("tenantId")
            or query_parameters.get("tenant_id")
        )

        print(
            "Invoice API request:",
            json.dumps(
                {
                    "httpMethod": event.get("httpMethod"),
                    "path": path,
                    "pathParameters": path_parameters,
                    "queryStringParameters": query_parameters,
                }
            ),
        )

        # =====================================================
        # 3. GET /invoices/{invoiceId}/download
        # =====================================================

        if invoice_id and path.endswith("/download"):

            response = table.get_item(
                Key={
                    "invoiceId": invoice_id
                }
            )

            item = response.get("Item")

            if not item:
                return {
                    "statusCode": 404,
                    "headers": headers,
                    "body": json.dumps(
                        {
                            "error": "Invoice not found",
                            "invoiceId": invoice_id,
                        }
                    ),
                }

            s3_key = item.get("s3Key")

            if not s3_key:
                return {
                    "statusCode": 404,
                    "headers": headers,
                    "body": json.dumps(
                        {
                            "error": "Invoice PDF not found"
                        }
                    ),
                }

            # Generate a fresh URL
            download_url = generate_presigned_url(
                s3_key
            )

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(
                    {
                        "invoiceId": item.get("invoiceId"),
                        "orderId": item.get("orderId"),
                        "downloadUrl": download_url,
                    }
                ),
            }

        # =====================================================
        # 4. GET /invoices/{invoiceId}
        # =====================================================

        if invoice_id:

            response = table.get_item(
                Key={
                    "invoiceId": invoice_id
                }
            )

            item = response.get("Item")

            if not item:
                return {
                    "statusCode": 404,
                    "headers": headers,
                    "body": json.dumps(
                        {
                            "error": "Invoice not found",
                            "invoiceId": invoice_id,
                        }
                    ),
                }

            # Refresh presigned URL
            if item.get("s3Key"):
                item["downloadUrl"] = generate_presigned_url(
                    item["s3Key"]
                )

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(
                    {
                        "invoice": item
                    }
                ),
            }

        # =====================================================
        # 5. GET /invoices?tenantId=...
        # =====================================================

        if tenant_id:

            response = table.scan()

            raw_items = response.get(
                "Items",
                []
            )

            items = [
                item
                for item in raw_items
                if (
                    item.get("tenantId") == tenant_id
                    or item.get("tenant_id") == tenant_id
                )
            ]

            items.sort(key=lambda i: i.get("createdAt", ""), reverse=True)

            # Refresh presigned URLs
            for item in items:

                if item.get("s3Key"):

                    try:
                        item["downloadUrl"] = (
                            generate_presigned_url(
                                item["s3Key"]
                            )
                        )

                    except Exception as exc:
                        print(
                            f"Error generating URL: {exc}"
                        )

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(
                    {
                        "invoices": items
                    }
                ),
            }

        # =====================================================
        # 6. No invoiceId and no tenantId
        # =====================================================

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps(
                {
                    "invoices": []
                }
            ),
        }

    except Exception as exc:

        print(
            f"Invoice API error: {str(exc)}"
        )

        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps(
                {
                    "error": str(exc)
                }
            ),
        }



def handler(event, context):
    print(
        "Received Payload:",
        json.dumps(event)
    )

    if "httpMethod" in event:
        return handle_get_invoice_api(event)

    elif event.get("source") == "app.payment_svc":
        return handle_payment_event(event)

    return {
        "statusCode": 400,
        "body": json.dumps(
            {
                "error": "Unknown event source"
            }
        ),
    }