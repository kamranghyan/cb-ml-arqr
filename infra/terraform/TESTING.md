# CB-ML Dev Infra — CLI Testing Guide

Covers every resource deployed so far. Region is `ap-south-1` unless noted (CloudFront/WAF/ACM resources are `us-east-1` by AWS requirement). Replace `<...>` placeholders; everything else is copy-paste ready.

Get every Terraform output first — most commands below just reference these:

```bash
cd infra/terraform/environments/dev
terraform output
```

---

## 1. Foundation

```bash
# State bucket + lock table (bootstrap)
aws s3 ls | grep cb-ml-arqr-terraform-state
aws dynamodb describe-table --table-name cb-ml-arqr-terraform-locks --region ap-south-1 --query "Table.TableStatus"

# Confirm which account Terraform is actually using vs. your CLI session
aws sts get-caller-identity
terraform state show 'module.data.aws_s3_bucket.this["menu_assets"]' | grep -i arn
```

---

## 2. Data Layer — DynamoDB

```bash
aws dynamodb list-tables --region ap-south-1 --output table
```

Expect 13 tables: `cb-ml-dev-{menu(dead, unused — flagged, not deleted), order, tenant, restaurant, category, item, addon, dining, payment, plan-types, tenant-subscription, invoices, connection, ws-order-subscriptions}`.

```bash
# Spot-check schema on the two rebuilt ones
aws dynamodb describe-table --table-name cb-ml-dev-order --region ap-south-1 \
  --query "Table.{Keys:KeySchema,GSIs:GlobalSecondaryIndexes[].IndexName,Stream:StreamSpecification}"

aws dynamodb describe-table --table-name cb-ml-dev-connection --region ap-south-1 \
  --query "Table.{Keys:KeySchema,GSIs:GlobalSecondaryIndexes[].IndexName,TTL:TimeToLiveDescription}"

# Order table's stream ARN (needed by ws_order_created — confirm it matches)
terraform output order_table_stream_arn
```

## 3. Data Layer — S3 Buckets

```bash
aws s3 ls | grep cb-ml-dev
```

Expect 8: `menu-assets, ar-models, analytics-archive, logs, invoices, guest-ui, kds-ui, admin-ui`.

```bash
# Confirm lockdown state matches enable_direct_s3_hosting
aws s3api get-public-access-block --bucket cb-ml-dev-guest-ui --region ap-south-1
# block_public_policy/restrict_public_buckets = false only while testing mode is on
```

## 4. Secrets — SSM Parameter Store

```bash
aws ssm get-parameters-by-path --path "/cb-ml/dev/" --region ap-south-1 \
  --query "Parameters[].{Name:Name,Type:Type}" --output table
```

## 5. Auth — Cognito

```bash
terraform state list | grep aws_cognito

USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null || \
  aws cognito-idp list-user-pools --max-results 20 --region ap-south-1 --query "UserPools[?contains(Name,'cb-ml-dev')].Id" --output text)

aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" --region ap-south-1 \
  --query "UserPool.{Id:Id,Name:Name}"
aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --region ap-south-1
```

---

## 6. Compute — Lambda Functions

```bash
aws lambda list-functions --region ap-south-1 \
  --query "Functions[?starts_with(FunctionName,'cb-ml-dev')].{Name:FunctionName,Runtime:Runtime,Modified:LastModified}" \
  --output table
```

Expect 13 functions: the 7 REST services (`menu-svc, order-svc, ar-svc, pay-svc, subs-svc, auth-svc, invoice-svc`), `glb-svc`, 4 WebSocket functions (`ws-connect, ws-disconnect, ws-message, ws-order-created`), `notif-svc`, `subs-payment-event-handler`.

```bash
# Shared layer
aws lambda list-layers --region ap-south-1 \
  --query "Layers[?starts_with(LayerName,'cb-ml-dev')].{Name:LayerName,Version:LatestMatchingVersion.Version}"

# IAM roles (one per service)
aws iam list-roles --query "Roles[?starts_with(RoleName,'cb-ml-dev')].RoleName" --output table

# Log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/cb-ml-dev" --region ap-south-1 \
  --query "logGroups[].logGroupName" --output table
```

### Direct invoke (bypasses API Gateway — good for isolating Lambda-vs-routing issues)

```bash
aws lambda invoke --function-name cb-ml-dev-menu-svc \
  --payload '{"httpMethod":"GET","path":"/health","headers":{}}' \
  --cli-binary-format raw-in-base64-out /tmp/out.json --region ap-south-1 && cat /tmp/out.json
```
Repeat for `order-svc`, `subs-svc` (all have `/health`). `pay-svc`, `auth-svc`, `invoice-svc`, `ar-svc` have no dedicated health route — use `"path":"/"` and expect a routed (not crashed) response.

---

## 7. API Gateway — REST (one API per service, not shared)

```bash
terraform output api_urls
```

```bash
BASE=$(terraform output -json api_urls | jq -r '.menu_svc')
curl -i "$BASE/health"
curl -i "$BASE/menus?restaurantId=test-123"

curl -i "$(terraform output -json api_urls | jq -r '.order_svc')/health"
curl -i "$(terraform output -json api_urls | jq -r '.auth_svc')/"
curl -i "$(terraform output -json api_urls | jq -r '.subs_svc')/health"
curl -i "$(terraform output -json api_urls | jq -r '.invoice_svc')/invoices/test-1"
```

CORS preflight check (matters once the frontends call these from the browser):
```bash
curl -i -X OPTIONS "$BASE/menus" -H "Origin: http://cb-ml-dev-guest-ui.s3-website.ap-south-1.amazonaws.com"
# expect 200 with Access-Control-Allow-* headers
```

**No authorizer wired yet** — every route above is open. Fine for dev testing, not for anything beyond that.

---

## 8. WebSocket API (ws_svc)

```bash
terraform output websocket_url   # wss://...

npm install -g wscat   # once
wscat -c "$(terraform output -raw websocket_url)?guestSessionId=test-session-123"
```
While connected:
```bash
aws dynamodb scan --table-name cb-ml-dev-connection --region ap-south-1
```
Ctrl+C to disconnect, re-run the scan — row should be gone.

```bash
aws logs tail /aws/lambda/cb-ml-dev-ws-connect --region ap-south-1 --since 5m
aws logs tail /aws/lambda/cb-ml-dev-ws-disconnect --region ap-south-1 --since 5m
aws logs tail /aws/lambda/cb-ml-dev-ws-order-created --region ap-south-1 --since 5m
```

Trigger `ws_order_created` via the DynamoDB stream directly:
```bash
aws dynamodb put-item --table-name cb-ml-dev-order --region ap-south-1 --item '{
  "PK": {"S": "TENANT#test-tenant#ORDER#test-stream-1"},
  "SK": {"S": "STATUS#2026-09-16T12:00:00Z"},
  "restaurantId": {"S": "test-rest"},
  "placedAt": {"S": "2026-09-16T12:00:00Z"}
}'
```

---

## 9. Event-Driven Infra

**Order state machine:**
```bash
terraform output order_state_machine_arn

aws stepfunctions start-execution \
  --state-machine-arn $(terraform output -raw order_state_machine_arn) \
  --name test-run-$(date +%s) \
  --input '{"orderId":"test-1","tenantId":"test-tenant","restaurantId":"test-rest","guestConnectionId":"","guestSessionId":"test-session","kitchenAccepted":false,"foodReady":false,"delivered":false,"cancelled":false}' \
  --region ap-south-1

aws stepfunctions list-executions --state-machine-arn $(terraform output -raw order_state_machine_arn) --region ap-south-1 --max-results 5
```

**Notifications queue + DLQ:**
```bash
terraform output notifications_queue_url

aws sqs send-message --queue-url "$(terraform output -raw notifications_queue_url)" --region ap-south-1 \
  --message-body '{"orderId":"test-1","tenantId":"test-tenant","status":"RECEIVED","message":"test"}'

aws logs tail /aws/lambda/cb-ml-dev-notif-svc --region ap-south-1 --since 5m
aws cloudwatch describe-alarms --alarm-names cb-ml-dev-notifications-dlq-not-empty --region ap-south-1 --query "MetricAlarms[].StateValue"
```

**EventBridge bus (pay_svc → subs_svc):**
```bash
terraform output event_bus_name

aws events put-events --region ap-south-1 --entries '[{
  "Source": "app.payment_svc",
  "DetailType": "payment.succeeded",
  "EventBusName": "cb-ml-dev-events",
  "Detail": "{\"tenant_id\":\"test-tenant\",\"plan_id\":\"test-plan\",\"payment_id\":\"test-pay-1\",\"payment_status\":\"succeeded\",\"amount\":1000,\"currency\":\"PKR\",\"order_id\":\"test-order-1\"}"
}]'
aws logs tail /aws/lambda/cb-ml-dev-subs-payment-event-handler --region ap-south-1 --since 5m
```

**subs_svc daily expiry schedule** (not directly invokable — confirm the rule exists, or temporarily change `schedule_expression` to `rate(2 minutes)` to test live):
```bash
aws events describe-rule --name cb-ml-dev-subs-daily-expiry --region ap-south-1
```

**glb_svc (S3-triggered .glb validator):**
```bash
aws s3 cp src/lambdas/glb_svc/real_test.glb \
  s3://cb-ml-dev-menu-assets/uploads/TENANT#test/restaurants/test-rest/ar-models/real_test.glb --region ap-south-1
sleep 5
aws s3 ls s3://cb-ml-dev-menu-assets/approved/ --recursive --region ap-south-1
aws logs tail /aws/lambda/cb-ml-dev-glb-svc --region ap-south-1 --since 5m

terraform output admin_alerts_topic_arn   # subscribe an email to see rejection alerts
```

---

## 10. Frontend Hosting (S3-direct, CloudFront skipped for now)

```bash
terraform output guest_ui_website_endpoint
terraform output admin_ui_website_endpoint
terraform output kds_ui_website_endpoint
```
Plain HTTP, only live while `enable_direct_s3_hosting = true`.

## 11. CloudFront / WAF

```bash
aws cloudfront list-distributions --region us-east-1 --query "DistributionList.Items[].{Id:Id,Domain:DomainName}"
```
Expect empty until the AWS Support account-verification ticket clears. Once it does: `terraform apply -var="enable_direct_s3_hosting=false"`, then re-check this section and swap `ar_svc`'s `CF_DOMAIN` back to the real CloudFront domain (currently pointed at the S3 bucket domain directly as a workaround).

---

## Known gaps — not yet built, not covered above

- **CI/CD still uses static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` GitHub Secrets**, not the OIDC role from the original spec.
- **WAF status unconfirmed** — `aws_wafv2_web_acl` was never confirmed present or absent in `modules/cdn/main.tf`; flagged twice, never checked.
- **`modules/observability`'s hardcoded log groups** (`auth, menu, order, tenant, test-pipeline, websocket`) are orphaned from the original mock-lambda module — the real functions each create their own log group inside `compute` now. Safe to remove, not done yet.
- **No API Gateway authorizer** — every REST route is open right now.
- **`cb-ml-dev-menu` DynamoDB table is dead** (confirmed unused in code) — left in place, not deleted.
- **Custom domain** (`app.cognitobay.com`) — untouched, `enable_custom_domain = false` as originally planned.
