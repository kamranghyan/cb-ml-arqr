# Step 9 — Observability Module (CloudWatch Log Groups)

## What This Creates

| Log Group | Retention |
|---|---|
| /aws/lambda/cb-ml-dev-menu | 14 days |
| /aws/lambda/cb-ml-dev-order | 14 days |
| /aws/lambda/cb-ml-dev-tenant | 14 days |
| /aws/lambda/cb-ml-dev-auth | 14 days |
| /aws/lambda/cb-ml-dev-websocket | 14 days |

---

## Changes Required in Existing Files

**`environments/dev/main.tf`** — append at bottom:
```hcl
module "observability" {
  source             = "../../modules/observability"
  prefix             = var.prefix
  environment        = var.environment
  owner              = var.owner
  log_retention_days = 14
}
```

**`environments/dev/outputs.tf`** — append at bottom:
```hcl
output "log_group_names" {
  description = "CloudWatch log group names per Lambda"
  value       = module.observability.log_group_names
}
```

---

## Deploy

```bash
cd infra/terraform/environments/dev

terraform plan    # should show 6 new log groups
terraform apply
```

---

## Testing Checklist

```bash
# 1. List all log groups for dev environment
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/cb-ml-dev" \
  --region ap-south-1 \
  --query "logGroups[].{Name:logGroupName,Retention:retentionInDays}"

# Expected output:
# [
#   { "Name": "/aws/lambda/cb-ml-dev-menu-service",          "Retention": 14 },
#   { "Name": "/aws/lambda/cb-ml-dev-order-service",         "Retention": 14 },
#   { "Name": "/aws/lambda/cb-ml-dev-tenant-service",        "Retention": 14 },
#   { "Name": "/aws/lambda/cb-ml-dev-auth-service",          "Retention": 14 },
#   { "Name": "/aws/lambda/cb-ml-dev-websocket-connect",     "Retention": 14 },
#   { "Name": "/aws/lambda/cb-ml-dev-websocket-disconnect",  "Retention": 14 }
# ]

# 2. Verify retention is set correctly
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/cb-ml-dev" \
  --region ap-south-1 \
  --query "logGroups[?retentionInDays!=\`14\`]"
# Expected: empty list [] — all groups have 14 day retention

# 3. Check outputs
terraform output log_group_names
# Expected: map of Lambda name to log group name
```

---

## Adding a New Lambda Later

Open `modules/observability/main.tf` and add to the `lambda_functions` list:

```hcl
local {
  lambda_functions = [
    "menu-service",
    "order-service",
    ...
    "your-new-lambda",   # add here
  ]
}
```

Then run `terraform apply` — new log group created automatically.

---

## Next Steps (deferred)
- CloudWatch Alarms (error rate, throttles)
- X-Ray tracing
- SNS notifications
