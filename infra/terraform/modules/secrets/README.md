# Step 6 — Secrets Module (SSM Parameter Store)

## What This Creates

| Parameter Path | Type | Description |
|---|---|---|
| /cb-ml/dev/cognito-user-pool-id | SecureString | Cognito User Pool ID |
| /cb-ml/dev/cognito-client-id | SecureString | Cognito App Client ID |
| /cb-ml/dev/api-key | SecureString | Internal API key |
| /cb-ml/dev/allowed-origins | String | CORS allowed origins |
| /cb-ml/dev/environment | String | Current environment name |
| /cb-ml/dev/menu-assets-bucket | String | S3 bucket name from data module |

**SecureString** = encrypted by AWS KMS, never visible in plain text in AWS console.
**String** = plain text, for non-sensitive config values.

---

## How Lambda Reads These at Runtime

```python
import boto3

ssm = boto3.client('ssm')

def get_parameter(name):
    response = ssm.get_parameter(Name=name, WithDecryption=True)
    return response['Parameter']['Value']

# Usage inside Lambda handler
api_key = get_parameter('/cb-ml/dev/api-key')
```

Lambda needs `ssm:GetParameter` IAM permission — added in Step 11 (compute module).

---

## Run Order

```bash
cd infra/terraform/environments/dev

# Set secrets as environment variables (recommended — avoids committing secrets)
export TF_VAR_aws_access_key="YOUR_ACCESS_KEY"
export TF_VAR_aws_secret_key="YOUR_SECRET_KEY"
export TF_VAR_api_key="YOUR_API_KEY"

terraform init -reconfigure
terraform plan    # should show 6 new SSM parameters
terraform apply
```

---

## Testing Checklist

```bash
# List all parameters for dev environment
aws ssm get-parameters-by-path \
  --path "/cb-ml/dev" \
  --with-decryption \
  --region us-east-1 \
  --query "Parameters[].{Name:Name,Type:Type}"

# Expected: 6 parameters listed

# Read a specific SecureString parameter
aws ssm get-parameter \
  --name "/cb-ml/dev/api-key" \
  --with-decryption \
  --region us-east-1 \
  --query "Parameter.Value"

# Verify SecureString is encrypted (without --with-decryption flag)
aws ssm get-parameter \
  --name "/cb-ml/dev/api-key" \
  --region us-east-1 \
  --query "Parameter.Value"
# Expected: "invalid" or error — confirms encryption is working
```

---

## Important Notes

- `cognito_user_pool_id` and `cognito_client_id` default to `PLACEHOLDER` — update after **Step 7 (Auth module)**
- Never put real secrets in `terraform.tfvars` — use `TF_VAR_` environment variables
- Add `terraform.tfvars` to `.gitignore`

---

## Next Step

**Step 7 → Auth Module (Cognito)** — after applying, update Cognito parameter values here.
