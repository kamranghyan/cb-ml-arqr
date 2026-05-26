# =============================================================================
# SECRETS MODULE — SSM Parameter Store
# Stores config and secrets Lambda functions read at runtime.
# All sensitive values use SecureString (encrypted by AWS KMS).
# Non-sensitive config uses String type.
# =============================================================================

locals {
  path_prefix = "/${var.prefix}/${var.environment}"

  common_tags = {
    Project     = var.prefix
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
  }
}

# -----------------------------------------------------------------------------
# SENSITIVE PARAMETERS (SecureString — encrypted at rest)
# -----------------------------------------------------------------------------

resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name        = "${local.path_prefix}/cognito-user-pool-id"
  description = "Cognito User Pool ID"
  type        = "SecureString"
  value       = var.cognito_user_pool_id

  tags = local.common_tags
}

resource "aws_ssm_parameter" "cognito_client_id" {
  name        = "${local.path_prefix}/cognito-client-id"
  description = "Cognito App Client ID"
  type        = "SecureString"
  value       = var.cognito_client_id

  tags = local.common_tags
}

resource "aws_ssm_parameter" "api_key" {
  name        = "${local.path_prefix}/api-key"
  description = "Internal API key for service-to-service calls"
  type        = "SecureString"
  value       = var.api_key

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# NON-SENSITIVE CONFIG (String — no encryption needed)
# -----------------------------------------------------------------------------

resource "aws_ssm_parameter" "allowed_origins" {
  name        = "${local.path_prefix}/allowed-origins"
  description = "CORS allowed origins for API Gateway"
  type        = "String"
  value       = var.allowed_origins

  tags = local.common_tags
}

resource "aws_ssm_parameter" "environment" {
  name        = "${local.path_prefix}/environment"
  description = "Current deployment environment"
  type        = "String"
  value       = var.environment

  tags = local.common_tags
}

resource "aws_ssm_parameter" "menu_assets_bucket" {
  name        = "${local.path_prefix}/menu-assets-bucket"
  description = "S3 bucket name for menu assets — passed from data module"
  type        = "String"
  value       = var.menu_assets_bucket

  tags = local.common_tags
}
