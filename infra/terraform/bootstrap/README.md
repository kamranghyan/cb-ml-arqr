# Step 1 — Bootstrap: S3 State + DynamoDB Lock

## Prerequisites

Before running anything, ensure you have:

- [ ] AWS CLI installed: `aws --version`
- [ ] Terraform installed (>= 1.10.0): `terraform version`
- [ ] AWS credentials configured for the **management account** with admin access
- [ ] Correct account active: `aws sts get-caller-identity`

---

## Files in This Directory

```
bootstrap/
├── main.tf           ← S3 buckets + DynamoDB table definitions
├── variables.tf      ← Input variable declarations
├── outputs.tf        ← Outputs you'll copy into environment backend configs
├── terraform.tfvars  ← Your project-specific values
└── README.md         ← This file
```

---

## Run Order

### 1. Verify your AWS identity

```bash
aws sts get-caller-identity
```

Expected output — confirms you're in the right account:
```json
{
    "UserId": "AIDXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-name"
}
```

---

### 2. Edit terraform.tfvars

Open `terraform.tfvars` and confirm:
- `aws_region`   — where you want the state bucket (pick one region, stick with it)
- `project_name` — short identifier, lowercase, no spaces (default: `arqr`)
- `owner`        — your team name for tagging

---

### 3. Initialise Terraform (local backend — no remote yet)

```bash
cd infra/terraform/bootstrap
terraform init
```

Expected output:
```
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.x.x...
Terraform has been successfully initialized!
```

---

### 4. Review the plan

```bash
terraform plan
```

You should see exactly **6 resources to create**:
```
+ aws_dynamodb_table.terraform_locks
+ aws_s3_bucket.state_logs
+ aws_s3_bucket.terraform_state
+ aws_s3_bucket_lifecycle_configuration.state_logs
+ aws_s3_bucket_lifecycle_configuration.terraform_state
+ aws_s3_bucket_logging.terraform_state
+ aws_s3_bucket_policy.terraform_state
+ aws_s3_bucket_public_access_block.state_logs
+ aws_s3_bucket_public_access_block.terraform_state
+ aws_s3_bucket_server_side_encryption_configuration.state_logs
+ aws_s3_bucket_server_side_encryption_configuration.terraform_state
+ aws_s3_bucket_versioning.terraform_state
```

No destroys, no updates — only creates. If you see anything else, stop and investigate.

---

### 5. Apply

```bash
terraform apply
```

Type `yes` when prompted. Takes approximately 30–60 seconds.

---

### 6. Save the outputs

```bash
terraform output
```

Copy the output values — especially `state_bucket_name` and `backend_config_snippet`.
You will paste these into every environment's `backend.tf` in Step 4 onward.

Example output:
```
state_bucket_name   = "arqr-terraform-state-123456789012"
lock_table_name     = "cb-ml-arqr-terraform-locks"
aws_region          = "us-east-1"
backend_config_snippet = <<EOT
  terraform {
    backend "s3" {
      bucket         = "arqr-terraform-state-123456789012"
      key            = "KEY_PATH/terraform.tfstate"
      region         = "us-east-1"
      dynamodb_table = "cb-ml-arqr-terraform-locks"
      encrypt        = true
    }
  }
EOT
```

---

### 7. Update environment backend files

Open each environment backend.tf and replace the placeholder:
```
environments/dev/backend.tf     → key = "dev/network/terraform.tfstate"
environments/staging/backend.tf → key = "staging/network/terraform.tfstate"
environments/prod/backend.tf    → key = "prod/network/terraform.tfstate"
```

Replace `REPLACE_WITH_state_bucket_name_output` with the actual bucket name.

---

## Testing Checklist

Run these checks after `terraform apply` completes.

### ✅ S3 State Bucket

```bash
# 1. Bucket exists
aws s3 ls | grep arqr-terraform-state

# 2. Versioning is enabled
aws s3api get-bucket-versioning \
  --bucket arqr-terraform-state-$(aws sts get-caller-identity --query Account --output text)

# Expected: {"Status": "Enabled"}

# 3. Encryption is enabled
aws s3api get-bucket-encryption \
  --bucket arqr-terraform-state-$(aws sts get-caller-identity --query Account --output text)

# Expected: SSEAlgorithm: AES256

# 4. Public access is fully blocked
aws s3api get-public-access-block \
  --bucket arqr-terraform-state-$(aws sts get-caller-identity --query Account --output text)

# Expected: all four values = true

# 5. Logging is configured
aws s3api get-bucket-logging \
  --bucket arqr-terraform-state-$(aws sts get-caller-identity --query Account --output text)

# Expected: LoggingEnabled block pointing to logs bucket
```

### ✅ DynamoDB Lock Table

```bash
# Table exists and is ACTIVE
aws dynamodb describe-table \
  --table-name cb-ml-arqr-terraform-locks \
  --query "Table.{Name:TableName,Status:TableStatus,Key:KeySchema}"

# Expected:
# {
#   "Name": "cb-ml-arqr-terraform-locks",
#   "Status": "ACTIVE",
#   "Key": [{"AttributeName": "LockID", "KeyType": "HASH"}]
# }
```

### ✅ Lock Behaviour (Concurrent Run Test)

Open two terminals. In Terminal 1:

```bash
# Start a slow plan (sleep forces it to hold the lock)
terraform plan && sleep 60
```

In Terminal 2, immediately run:

```bash
terraform plan
```

Terminal 2 should print:
```
Error: Error locking state: Error acquiring the state lock
Lock Info:
  ID:        xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Path:      arqr-terraform-state-.../bootstrap/terraform.tfstate
  Operation: OperationTypePlan
  ...
```

This confirms the DynamoDB lock is working correctly.

### ✅ State File Appears in S3

After any `terraform plan` or `apply`:

```bash
aws s3 ls s3://arqr-terraform-state-$(aws sts get-caller-identity \
  --query Account --output text)/bootstrap/
```

You should see `terraform.tfstate` listed.

---

## Important Notes

**Never delete these resources manually.**
The `prevent_destroy = true` lifecycle blocks in `main.tf` protect against accidental
`terraform destroy`. If you genuinely need to tear down bootstrap, remove those lifecycle
blocks first, then destroy — but only after migrating all state elsewhere.

**Commit the bootstrap state file carefully.**
The local `terraform.tfstate` in this directory tracks the S3 bucket and DynamoDB table
themselves. Store it in a safe location (another S3 bucket, or committed to the repo — 
it contains no secrets, only resource IDs).

**This directory is run once — not by CI/CD.**
All other modules use the remote backend configured here.
Bootstrap itself stays on local state intentionally.

---

## State Key Convention (Reference for All Future Steps)

```
{bucket}/
├── bootstrap/terraform.tfstate          ← tracks the bucket+table themselves
├── global/terraform.tfstate             ← AWS Org, SSO (Step 2)
├── dev/
│   ├── network/terraform.tfstate        ← Step 4
│   ├── data/terraform.tfstate           ← Step 5
│   ├── secrets/terraform.tfstate        ← Step 6
│   ├── auth/terraform.tfstate           ← Step 7
│   ├── cdn/terraform.tfstate            ← Step 8
│   └── observability/terraform.tfstate  ← Step 9
├── staging/
│   └── ... (mirrors dev)
└── prod/
    └── ... (mirrors dev)
```
