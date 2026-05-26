# =============================================================================
# DEV ENVIRONMENT — OUTPUTS
# Run: terraform output
# =============================================================================

# --- Data Module -------------------------------------------------------------

output "menu_table_name" {
  value = module.data.menu_table_name
}

output "order_table_name" {
  value = module.data.order_table_name
}

output "tenant_table_name" {
  value = module.data.tenant_table_name
}

output "connection_table_name" {
  value = module.data.connection_table_name
}

output "bucket_menu_assets" {
  value = module.data.bucket_menu_assets
}

output "bucket_ar_models" {
  value = module.data.bucket_ar_models_name
}

# --- Auth Module -------------------------------------------------------------

output "user_pool_id" {
  description = "Use this in your frontend Amplify config"
  value       = module.auth.user_pool_id
}

output "admin_client_id" {
  description = "Use this in your admin dashboard Amplify config"
  value       = module.auth.admin_client_id
}

output "guest_client_id" {
  description = "Use this in your guest PWA Amplify config"
  value       = module.auth.guest_client_id
}

output "identity_pool_id" {
  description = "Use this in your frontend Amplify config"
  value       = module.auth.identity_pool_id
}

# --- CDN Module --------------------------------------------------------------

output "cloudfront_url" {
  description = "Your app URL — use this in frontend API calls"
  value       = module.cdn.cloudfront_url
}

output "cloudfront_distribution_id" {
  description = "Use this for cache invalidation in CI/CD"
  value       = module.cdn.cloudfront_distribution_id
}

output "waf_web_acl_arn" {
  value = module.cdn.waf_web_acl_arn
}

# --- SSM Paths (for Lambda config reference) ---------------------------------

output "ssm_cognito_user_pool_id_path" {
  value = module.secrets.cognito_user_pool_id_path
}

output "ssm_api_key_path" {
  value = module.secrets.api_key_path
}

# --- Cloud Watch logs group (for Lambda) ---------------------------------

output "log_group_names" {
  description = "CloudWatch log group names per Lambda"
  value       = module.observability.log_group_names
}
