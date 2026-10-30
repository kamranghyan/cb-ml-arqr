# CB-ML Infrastructure — IaC & CI/CD

## Project Overview

AR QR Menu Platform — Multi-tenant, Serverless, AWS-native infrastructure built with Terraform.

**Region:** ap-south-1 (Mumbai)
**Environment:** dev (staging + prod to be added later)
**Naming Convention:** `cb-ml-{environment}-{resource}`

---

## Repository Structure

```
your-project-root/
├── .github/
│   └── workflows/
│       ├── terraform-plan.yml     ← runs on every PR
│       └── terraform-apply.yml    ← runs on merge to main
│
├── infra/
│   ├── README.md                  ← this file
│   ├── .gitignore
│   └── terraform/
│       ├── bootstrap/             ← Step 1: S3 state + DynamoDB lock
│       ├── modules/
│       │   ├── data/              ← Step 5: DynamoDB + S3
│       │   ├── secrets/           ← Step 6: SSM Parameter Store
│       │   ├── auth/              ← Step 7: Cognito
│       │   ├── cdn/               ← Step 8: CloudFront + WAF
│       │   └── observability/     ← Step 9: CloudWatch Log Groups
│       └── environments/
│           └── dev/
│               ├── main.tf
│               ├── variables.tf
│               ├── outputs.tf
│               ├── backend.tf
│               └── terraform.tfvars
│
└── src/
    └── lambdas/                   ← Step 11: Mock Lambda functions
        ├── menu-service/
        ├── order-service/
        ├── tenant-service/
        ├── auth-service/
        ├── websocket-connect/
        └── websocket-disconnect/
```

---

## Prerequisites

Before running anything ensure you have:

- AWS CLI installed: `aws --version`
- Terraform >= 1.10.0: `terraform version`
- AWS credentials configured
- GitHub repository created

---

## Steps Completed

---

### ✅ Step 1 — Bootstrap (S3 State + DynamoDB Lock)

**Purpose:** Creates remote state storage so Terraform state is shared across team and CI/CD.

**What it creates:**
- S3 bucket: `cb-ml-terraform-state-{account-id}` — stores all `.tfstate` files
- S3 bucket: `cb-ml-terraform-state-logs-{account-id}` — access logs
- DynamoDB table: `cb-ml-terraform-locks` — prevents concurrent applies

**Run once manually:**
```bash
cd infra/terraform/bootstrap

terraform init
terraform plan
terraform apply

# Copy output bucket name into environments/dev/main.tf backend block
terraform output state_bucket_name
```

**State key layout:**
```
s3-bucket/
├── bootstrap/terraform.tfstate
├── dev/main/terraform.tfstate
├── staging/main/terraform.tfstate
└── prod/main/terraform.tfstate
```

---

### ⏭️ Step 2 — AWS Organisation & SSO (Skipped)
Using single AWS account with Access Key + Secret Key directly.

---

### ⏭️ Step 3 — Cross-Account IAM Roles (Skipped)
Not required for single account setup.

---

### ⏭️ Step 4 — Network Module (Skipped)
Not required for MVP — Lambda runs outside VPC.
Redis and RDS excluded from MVP scope.

---

### ✅ Step 5 — Data Module (DynamoDB + S3)

**Purpose:** Creates all data storage resources.

**What it creates:**

DynamoDB Tables:
| Table | Hash Key | Range Key | GSIs |
|---|---|---|---|
| cb-ml-dev-MenuTable | restaurantId | itemId | byCategory |
| cb-ml-dev-OrderTable | orderId | createdAt | byRestaurantId, byStatus |
| cb-ml-dev-TenantTable | tenantId | — | bySlug |
| cb-ml-dev-ConnectionTable | connectionId | — | byTenantId |

S3 Buckets:
| Bucket | Versioning | Lifecycle |
|---|---|---|
| cb-ml-dev-menu-assets | ON | — |
| cb-ml-dev-ar-models | ON | — |
| cb-ml-dev-analytics-archive | OFF | Glacier after 30 days |
| cb-ml-dev-logs | OFF | Expire after 90 days |

**Module location:** `infra/terraform/modules/data/`

---

### ✅ Step 6 — Secrets (SSM Parameter Store)

**Purpose:** Stores secrets and config Lambda functions read at runtime. Free alternative to Secrets Manager.

**Parameters created:**
| Path | Type |
|---|---|
| /cb-ml/dev/cognito-user-pool-id | SecureString |
| /cb-ml/dev/cognito-client-id | SecureString |
| /cb-ml/dev/api-key | SecureString |
| /cb-ml/dev/allowed-origins | String |
| /cb-ml/dev/environment | String |
| /cb-ml/dev/menu-assets-bucket | String |

**Note:** `cognito-user-pool-id` and `cognito-client-id` are auto-populated from the auth module — no manual entry needed.

**Module location:** `infra/terraform/modules/secrets/`

**How Lambda reads secrets:**
```python
import boto3
ssm = boto3.client('ssm')
value = ssm.get_parameter(Name='/cb-ml/dev/api-key', WithDecryption=True)['Parameter']['Value']
```

---

### ✅ Step 7 — Auth Module (Cognito)

**Purpose:** Manages user authentication for admin and guest users.

**What it creates:**
| Resource | Name | Purpose |
|---|---|---|
| User Pool | cb-ml-dev-user-pool | Stores admin accounts |
| App Client (Admin) | cb-ml-dev-admin-client | Admin dashboard login |
| App Client (Guest) | cb-ml-dev-guest-client | Guest PWA access |
| Identity Pool | cb-ml-dev-identity-pool | Issues temporary AWS credentials |
| IAM Role (Guest) | cb-ml-dev-cognito-guest-role | Read-only S3 |
| IAM Role (Admin) | cb-ml-dev-cognito-admin-role | Full S3 read/write |

**Module location:** `infra/terraform/modules/auth/`

**Frontend Amplify config:**
```javascript
Amplify.configure({
  Auth: {
    region:              'ap-south-1',
    userPoolId:          'ap-south-1_XXXXXXXXX',   // from terraform output
    userPoolWebClientId: 'XXXXXXXXXXXXXXXX',        // from terraform output
    identityPoolId:      'ap-south-1:xxxx-xxxx',   // from terraform output
  }
})
```

---

### ✅ Step 8 — CDN + WAF Module (CloudFront + WAF)

**Purpose:** Serves static assets from edge locations and blocks malicious traffic.

**What it creates:**
| Resource | Details |
|---|---|
| WAF WebACL | OWASP Core Rules + rate limit 1000 req/5min/IP |
| CloudFront Distribution | Serves S3 assets globally |
| Origin Access Control | CloudFront accesses S3 privately |
| Security Headers Policy | XSS, HSTS, frame-options headers |
| S3 Bucket Policies | Only CloudFront can read buckets |

**Module location:** `infra/terraform/modules/cdn/`

**MVP:** Uses default CloudFront URL (`xxxx.cloudfront.net`)

**Adding custom domain later — only 3 variable changes:**
```hcl
# in environments/dev/terraform.tfvars
domain_name     = "menu.yourapp.com"
acm_cert_arn    = "arn:aws:acm:us-east-1:..."
route53_zone_id = "ZXXXXXXXXXXXXX"
```

> ⚠️ WAF must always be in `us-east-1` — handled automatically via provider alias.

---

### ✅ Step 9 — Observability Module (CloudWatch Log Groups)

**Purpose:** Creates log groups so Lambda logs are retained and organised.

**Log groups created:**
```
/aws/lambda/cb-ml-dev-menu-service           (14 days retention)
/aws/lambda/cb-ml-dev-order-service          (14 days retention)
/aws/lambda/cb-ml-dev-tenant-service         (14 days retention)
/aws/lambda/cb-ml-dev-auth-service           (14 days retention)
/aws/lambda/cb-ml-dev-websocket-connect      (14 days retention)
/aws/lambda/cb-ml-dev-websocket-disconnect   (14 days retention)
```

**Module location:** `infra/terraform/modules/observability/`

**Deferred (future steps):**
- CloudWatch Alarms
- X-Ray tracing
- SNS notifications

---

### ✅ Step 10 — CI/CD Pipeline (GitHub Actions)

**Purpose:** Automates Terraform plan and apply on every code change.

**Workflows:**
| File | Trigger | Action |
|---|---|---|
| `terraform-plan.yml` | Pull Request to main | fmt + validate + plan → PR comment |
| `terraform-apply.yml` | Merge to main | terraform apply automatically |

**Location:** `.github/workflows/` (project root — not inside infra/)

**GitHub Secrets required:**
| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `TF_VAR_API_KEY` | Internal API key |

**Daily workflow:**
```bash
git checkout -b feature/your-change
# make changes
git add . && git commit -m "your message"
git push origin feature/your-change
# open PR on GitHub → pipeline runs → review plan → merge
```

---

### ✅ Step 11 — Lambda Functions (Mock)

**Purpose:** Mock Lambda functions for testing API endpoints before real implementation.

**Functions:**
| Lambda | Methods | Mock Response |
|---|---|---|
| menu-service | GET, POST, PUT, DELETE | Menu items list / CRUD |
| order-service | GET, POST, PUT | Orders list / place order |
| tenant-service | GET, POST, PUT, DELETE | Tenants list / CRUD |
| auth-service | POST /login, POST /logout, GET /me | Token / user info |
| websocket-connect | WS connect | connectionId |
| websocket-disconnect | WS disconnect | connectionId |

**Location:** `src/lambdas/{service-name}/index.py`

---

## Running the Full Dev Environment

```bash
cd infra/terraform/environments/dev

# Set secrets as environment variables
export TF_VAR_aws_access_key="YOUR_KEY"
export TF_VAR_aws_secret_key="YOUR_SECRET"
export TF_VAR_api_key="YOUR_API_KEY"

# Deploy everything
terraform init -reconfigure
terraform plan
terraform apply

# View all outputs
terraform output
```

---

## Key Outputs After Apply

```
user_pool_id               → use in frontend Amplify config
admin_client_id            → use in admin dashboard
guest_client_id            → use in guest PWA
identity_pool_id           → use in frontend Amplify config
cloudfront_url             → your app URL (share with frontend team)
cloudfront_distribution_id → use for cache invalidation in CI/CD
menu_table_name            → cb-ml-dev-MenuTable
order_table_name           → cb-ml-dev-OrderTable
```

---

## Environment Variables Reference

| Variable | Where Set | Purpose |
|---|---|---|
| `TF_VAR_aws_access_key` | terminal / GitHub Secret | AWS auth |
| `TF_VAR_aws_secret_key` | terminal / GitHub Secret | AWS auth |
| `TF_VAR_api_key` | terminal / GitHub Secret | Internal API key |

---

## Pending Steps

| Step | Description |
|---|---|
| Compute Module | Terraform to deploy Lambda functions to AWS |
| API Gateway | REST + WebSocket API wired to Lambdas |
| Domain | Purchase domain + configure Route53 + ACM cert |
| CloudWatch Alarms | Error rate, throttle, Redis alarms |
| X-Ray | Distributed tracing across Lambdas |
| SNS | Alarm notifications |
| Staging Environment | Mirror of dev with separate state |
| Prod Environment | Production deployment with approval gate |

---

## Troubleshooting

**Backend init error:**
```bash
terraform init -reconfigure
```

**Lock error:**
```bash
terraform force-unlock LOCK_ID
```

**Credentials error:**
```bash
aws sts get-caller-identity  # verify correct account
```

**Format check fails in CI:**
```bash
terraform fmt -recursive     # run locally before pushing
```

# Step 11 — Compute Module (Lambda + API Gateway)

## What This Creates

| Resource | Name |
|---|---|
| Lambda | cb-ml-dev-menu-service |
| Lambda | cb-ml-dev-order-service |
| Lambda | cb-ml-dev-tenant-service |
| Lambda | cb-ml-dev-auth-service |
| Lambda | cb-ml-dev-websocket-connect |
| Lambda | cb-ml-dev-websocket-disconnect |
| API Gateway | cb-ml-dev-api |
| IAM Role | cb-ml-dev-lambda-exec-role |

---

## Changes to Existing Dev Files

**`environments/dev/main.tf`** — append:
```hcl
module "compute" {
  source           = "../../modules/compute"
  prefix           = var.prefix
  environment      = var.environment
  owner            = var.owner
  aws_region       = var.aws_region
  lambdas_src_path = "${path.root}/../../../../src/lambdas"
}
```

**`environments/dev/outputs.tf`** — append:
```hcl
output "api_gateway_url" {
  value = module.compute.api_gateway_url
}

output "lambda_function_names" {
  value = module.compute.lambda_function_names
}
```

---

## Deploy

```bash
cd infra/terraform/environments/dev

terraform init -reconfigure
terraform plan     # ~20 new resources
terraform apply

# Copy this URL for frontend
terraform output api_gateway_url
```

---

## Testing Checklist

```bash
# 1. Test menu endpoint
curl $(terraform output -raw api_gateway_url)/menu
# Expected: {"restaurantId": "r001", "items": [...]}

# 2. Test orders endpoint
curl $(terraform output -raw api_gateway_url)/orders
# Expected: {"orders": [...]}

# 3. Test tenants endpoint
curl $(terraform output -raw api_gateway_url)/tenants
# Expected: {"tenants": [...]}

# 4. Test auth endpoint
curl -X POST $(terraform output -raw api_gateway_url)/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@1234"}'
# Expected: {"accessToken": "mock-access-token-abc123", ...}

# 5. Check Lambda logs
aws logs tail /aws/lambda/cb-ml-dev-menu-service \
  --region ap-south-1 \
  --follow
```

---

## Frontend Setup

**1. Open `src/frontend/index.html`**

**2. Replace the API_BASE value:**
```javascript
const API_BASE = "REPLACE_WITH_api_gateway_url_output";
// becomes:
const API_BASE = "https://abc123.execute-api.ap-south-1.amazonaws.com/dev";
```

**3. Open in browser — click each Test button**

---

## Upload Frontend to S3 (public access)

```bash
# Enable public access on frontend bucket
aws s3 cp src/frontend/index.html \
  s3://cb-ml-dev-menu-assets/index.html \
  --content-type "text/html" \
  --region ap-south-1

# Access via CloudFront URL (from Step 8 output)
echo "Open: $(cd infra/terraform/environments/dev && terraform output -raw cloudfront_url)/index.html"
```
