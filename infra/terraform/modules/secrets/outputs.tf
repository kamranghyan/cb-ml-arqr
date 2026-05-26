# =============================================================================
# SECRETS MODULE — OUTPUTS
# Outputs are parameter NAMES (paths), not values.
# Lambda uses these paths to call ssm.get_parameter() at runtime.
# =============================================================================

output "cognito_user_pool_id_path" {
  description = "SSM path — Lambda reads this to get Cognito User Pool ID"
  value       = aws_ssm_parameter.cognito_user_pool_id.name
}

output "cognito_client_id_path" {
  description = "SSM path — Lambda reads this to get Cognito Client ID"
  value       = aws_ssm_parameter.cognito_client_id.name
}

output "api_key_path" {
  description = "SSM path — Lambda reads this to get the API key"
  value       = aws_ssm_parameter.api_key.name
}

output "allowed_origins_path" {
  description = "SSM path — Lambda reads this for CORS config"
  value       = aws_ssm_parameter.allowed_origins.name
}

output "menu_assets_bucket_path" {
  description = "SSM path — Lambda reads this to get the S3 bucket name"
  value       = aws_ssm_parameter.menu_assets_bucket.name
}

# All parameter paths in one list — used to build Lambda IAM policy in Step 11
output "all_parameter_paths" {
  description = "All SSM parameter ARNs — attach to Lambda execution role"
  value = [
    aws_ssm_parameter.cognito_user_pool_id.arn,
    aws_ssm_parameter.cognito_client_id.arn,
    aws_ssm_parameter.api_key.arn,
    aws_ssm_parameter.allowed_origins.arn,
    aws_ssm_parameter.menu_assets_bucket.arn,
  ]
}
