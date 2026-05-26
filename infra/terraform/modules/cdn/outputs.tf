# =============================================================================
# CDN MODULE — OUTPUTS
# =============================================================================

output "cloudfront_url" {
  description = "CloudFront distribution URL — use this in your app for MVP"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name (without https://)"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  description = "Distribution ID — used for cache invalidation in CI/CD"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_distribution_arn" {
  description = "Distribution ARN — used in WAF and S3 bucket policies"
  value       = aws_cloudfront_distribution.main.arn
}

output "waf_web_acl_arn" {
  description = "WAF WebACL ARN — attach to API Gateway in Step 8"
  value       = aws_wafv2_web_acl.main.arn
}
