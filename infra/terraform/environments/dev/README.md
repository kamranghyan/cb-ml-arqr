# Step 5 — Data Module (DynamoDB + S3)

## What This Creates

### DynamoDB Tables
| Table | Hash Key | Range Key | GSIs |
|---|---|---|---|
| cb-ml-dev-Menu | restaurantId | itemId | byCategory |
| cb-ml-dev-Order | orderId | createdAt | byRestaurantId, byStatus |
| cb-ml-dev-Tenant | tenantId | — | bySlug |
| cb-ml-dev-Connection | connectionId | — | byTenantId |

### S3 Buckets
| Bucket | Versioning | Extra |
|---|---|---|
| cb-ml-dev-menu-assets | ON | — |
| cb-ml-dev-ar-models | ON | — |
| cb-ml-dev-analytics-archive | OFF | Glacier after 30 days |
| cb-ml-dev-logs | OFF | Expire after 90 days |

---

## Prerequisites

- Step 1 bootstrap applied — S3 state bucket and DynamoDB lock table exist
- AWS credentials ready (Access Key + Secret Key)
- Terraform >= 1.6.0 installed

---

## Before You Run

**1. Get your state bucket name from bootstrap:**
```bash
cd infra/terraform/bootstrap
terraform output state_bucket_name
```

**2. Update `backend.tf` with the real bucket name:**
```hcl
bucket = "cb-ml-terraform-state-123456789012"  # your actual value
```

**3. Update `terraform.tfvars` with your real AWS credentials:**
```hcl
aws_access_key = "AKIAIOSFODNN7EXAMPLE"
aws_secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

> ⚠️ Never commit `terraform.tfvars` with real credentials.
> Add it to `.gitignore` or use environment variables instead:
> ```bash
> export TF_VAR_aws_access_key="YOUR_KEY"
> export TF_VAR_aws_secret_key="YOUR_SECRET"
> ```

---

## Run Order

```bash
cd infra/terraform/environments/dev

# 1. Initialise — connects to remote backend
terraform init

# 2. Review — should show 18 resources to create, zero destroys
terraform plan

# 3. Apply
terraform apply
```

---

## Testing Checklist

### DynamoDB

```bash
# List all 4 tables
aws dynamodb list-tables --region us-east-1 \
  --query "TableNames[?contains(@, 'cb-ml-dev')]"

# Verify PITR is enabled on MenuTable
aws dynamodb describe-continuous-backups \
  --table-name cb-ml-dev-MenuTable \
  --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus"
# Expected: "ENABLED"

# Verify GSI exists on OrderTable
aws dynamodb describe-table \
  --table-name cb-ml-dev-OrderTable \
  --query "Table.GlobalSecondaryIndexes[].IndexName"
# Expected: ["byRestaurantId", "byStatus"]

# Write and read a test item
aws dynamodb put-item \
  --table-name cb-ml-dev-MenuTable \
  --item '{"restaurantId":{"S":"r001"},"itemId":{"S":"i001"},"name":{"S":"Test Burger"}}'

aws dynamodb get-item \
  --table-name cb-ml-dev-MenuTable \
  --key '{"restaurantId":{"S":"r001"},"itemId":{"S":"i001"}}'
```

### S3

```bash
# List all 4 buckets
aws s3 ls | grep cb-ml-dev

# Verify versioning on menu-assets
aws s3api get-bucket-versioning --bucket cb-ml-dev-menu-assets
# Expected: {"Status": "Enabled"}

# Verify encryption on all buckets
aws s3api get-bucket-encryption --bucket cb-ml-dev-menu-assets
# Expected: SSEAlgorithm: AES256

# Verify public access is fully blocked
aws s3api get-public-access-block --bucket cb-ml-dev-menu-assets
# Expected: all four values = true

# Upload and retrieve a test file
echo "test" | aws s3 cp - s3://cb-ml-dev-menu-assets/test.txt
aws s3 ls s3://cb-ml-dev-menu-assets/
aws s3 rm s3://cb-ml-dev-menu-assets/test.txt
```

---

## Teardown (dev only)

```bash
terraform destroy
```

> `prod` tables have `deletion_protection_enabled = true` — destroy will fail safely.

---

## Next Step

**Step 6 → SSM Parameter Store** — store Lambda secrets (API keys, config values)
