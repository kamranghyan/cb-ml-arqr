# Step 7 — Auth Module (Cognito)

## What This Creates

| Resource | Name | Purpose |
|---|---|---|
| User Pool | cb-ml-dev-user-pool | Stores admin accounts, handles login |
| App Client (Admin) | cb-ml-dev-admin-client | Admin dashboard login |
| App Client (Guest) | cb-ml-dev-guest-client | Guest PWA anonymous access |
| Identity Pool | cb-ml-dev-identity-pool | Issues temporary AWS credentials |
| IAM Role (Guest) | cb-ml-dev-cognito-guest-role | Read-only S3 access |
| IAM Role (Admin) | cb-ml-dev-cognito-admin-role | Full S3 read/write access |

---

## Run Commands

```bash
cd infra/terraform/environments/dev

terraform init -reconfigure
terraform plan    # ~10 new resources
terraform apply
```

---

## After Apply — Note These Outputs

```bash
terraform output
```

You will see:
```
user_pool_id     = "us-east-1_XXXXXXXXX"
admin_client_id  = "XXXXXXXXXXXXXXXXXXXXXXXXXX"
identity_pool_id = "us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

These are **auto-wired into SSM** — no manual copy needed.
The secrets module reads them directly from auth module outputs.

---

## Testing Checklist

```bash
# 1. User Pool exists
aws cognito-idp list-user-pools --max-results 10 \
  --query "UserPools[?Name=='cb-ml-dev-user-pool']"

# 2. Create a test admin user
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_POOL_ID \
  --username test@example.com \
  --temporary-password Test@1234 \
  --region us-east-1

# 3. Verify Identity Pool exists
aws cognito-identity list-identity-pools --max-results 10 \
  --query "IdentityPools[?IdentityPoolName=='cb-ml-dev-identity-pool']"

# 4. Verify SSM was auto-updated
aws ssm get-parameter \
  --name "/cb-ml/dev/cognito-user-pool-id" \
  --with-decryption \
  --query "Parameter.Value"
# Expected: real Pool ID, not PLACEHOLDER
```

---

## How Your App Uses These Values

**Frontend (React/Vue):**
```javascript
import { Amplify } from 'aws-amplify'

Amplify.configure({
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_XXXXXXXXX',       // from terraform output
    userPoolWebClientId: 'XXXXXXXXXXXXXXXX',  // from terraform output
    identityPoolId: 'us-east-1:xxxx-xxxx',   // from terraform output
  }
})
```

**Lambda (token validation):**
```python
user_pool_id = ssm.get_parameter(
  Name='/cb-ml/dev/cognito-user-pool-id',
  WithDecryption=True
)['Parameter']['Value']
```

---

## Next Step

**Step 8 → CDN + WAF** — CloudFront distribution with WAF protection
