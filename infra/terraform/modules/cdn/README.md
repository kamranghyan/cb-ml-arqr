# Step 8 — CDN + WAF Module

## What This Creates

| Resource | Purpose |
|---|---|
| WAF WebACL | Blocks OWASP threats + rate limits 1000 req/5min/IP |
| CloudFront Distribution | Serves S3 assets from edge locations |
| Origin Access Control | CloudFront accesses S3 privately |
| Security Headers Policy | Adds XSS, HSTS, frame-options headers |
| S3 Bucket Policies | Allows only CloudFront to read S3 buckets |
| Route53 Record | Created only when domain variables are filled |

---

## Adding Domain Later (Next Week)

Just update these 3 variables in `terraform.tfvars`:

```hcl
domain_name     = "menu.yourapp.com"
acm_cert_arn    = "arn:aws:acm:us-east-1:123456789:certificate/xxxx"
route53_zone_id = "ZXXXXXXXXXXXXX"
```

Then run `terraform apply` — no code changes needed.

> ⚠️ ACM certificate must be created in `us-east-1` regardless of your main region.

---

## Run Commands

```bash
cd infra/terraform/environments/dev

terraform init -reconfigure
terraform plan     # ~8 new resources
terraform apply
terraform output   # copy cloudfront_url for your app
```

---

## Testing Checklist

```bash
# 1. Get CloudFront URL from output
CF_URL=$(terraform output -raw cloudfront_url)
echo $CF_URL   # https://xxxx.cloudfront.net

# 2. Upload test file and access via CloudFront
echo "hello" | aws s3 cp - s3://cb-ml-dev-menu-assets/test.txt
curl $CF_URL/test.txt
# Expected: "hello"

# 3. Verify WAF is attached
aws cloudfront get-distribution \
  --id $(terraform output -raw cloudfront_distribution_id) \
  --query "Distribution.DistributionConfig.WebACLId"
# Expected: WAF ARN

# 4. Test rate limiting — send 1001 requests
for i in {1..1001}; do curl -s -o /dev/null $CF_URL; done
# Expected: 403 block after 1000 requests

# 5. Cleanup test file
aws s3 rm s3://cb-ml-dev-menu-assets/test.txt
```

---

## Next Step

**Step 9 → Observability** — CloudWatch dashboards, alarms, X-Ray tracing
