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

# --- CloudWatch ---------------------------------------------------------
# NOTE: these still reference the old mock service names (menu-service,
# order-service, ...) — stale since the Compute rebuild. The real per-service
# log groups (/aws/lambda/cb-ml-dev-menu-svc etc.) are created directly
# inside the compute module now. Cleaning up this duplication in the
# observability module is a follow-up, not done yet.

output "log_group_names" {
  value = module.observability.log_group_names
}

# --- Compute -------------------------------------------------------------
# api_gateway_url removed — API Gateway is out of the compute module now
# (see module README). It comes back once the `api` module lands.

output "lambda_function_names" {
  value = module.compute.lambda_function_names
}

output "lambda_function_arns" {
  value = module.compute.lambda_function_arns
}

output "shared_layer_arn" {
  value = module.compute.shared_layer_arn
}