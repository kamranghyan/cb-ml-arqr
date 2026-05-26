# =============================================================================
# AUTH MODULE — OUTPUTS
# These feed into:
#   1. SSM Parameter Store (Step 6) — Lambda reads at runtime
#   2. Frontend config — app uses Pool ID + Client ID to initialise Cognito SDK
# =============================================================================

output "user_pool_id" {
  description = "Cognito User Pool ID — update SSM /cognito-user-pool-id after apply"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN — used in API Gateway authorizer (Step 8)"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Cognito User Pool endpoint"
  value       = aws_cognito_user_pool.main.endpoint
}

output "admin_client_id" {
  description = "Admin app client ID — update SSM /cognito-client-id after apply"
  value       = aws_cognito_user_pool_client.admin.id
}

output "guest_client_id" {
  description = "Guest app client ID — used by guest PWA frontend"
  value       = aws_cognito_user_pool_client.guest.id
}

output "identity_pool_id" {
  description = "Cognito Identity Pool ID — used by frontend to get AWS credentials"
  value       = aws_cognito_identity_pool.main.id
}
