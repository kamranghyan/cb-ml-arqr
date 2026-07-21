# =============================================================================
# AUTH MODULE — Cognito User Pool + Identity Pool
# =============================================================================
terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [ aws.us_east_1 ] # <-- This passes the provider into the module
    }
  }
}

locals {
  name_prefix = "${var.prefix}-${var.environment}"

  common_tags = {
    Project     = var.prefix
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
  }
}

# -----------------------------------------------------------------------------
# COGNITO USER POOL
# Stores admin user accounts — handles login, tokens, password policy
# -----------------------------------------------------------------------------
resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-user-pool"

  # Users sign in with email
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  # Email verification message
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your ${var.prefix} verification code"
    email_message        = "Your verification code is {####}"
  }

  # Token expiry settings
  user_pool_add_ons {
    advanced_security_mode = "OFF" # ON costs extra — keep OFF for MVP
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# APP CLIENT — Admin Dashboard
# Used by the admin frontend to login
# -----------------------------------------------------------------------------
resource "aws_cognito_user_pool_client" "admin" {
  name         = "${local.name_prefix}-admin-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # No client secret — SPA apps can't keep secrets safe
  generate_secret = false

  # Auth flows allowed
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  # Token expiry
  access_token_validity  = 1   # 1 hour
  id_token_validity      = 1   # 1 hour
  refresh_token_validity = 30  # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Allowed logout + callback URLs (update with real domain in prod)
  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true
  supported_identity_providers         = ["COGNITO"]
}

# -----------------------------------------------------------------------------
# APP CLIENT — Guest PWA
# Used by the guest frontend — anonymous access only
# -----------------------------------------------------------------------------
resource "aws_cognito_user_pool_client" "guest" {
  name         = "${local.name_prefix}-guest-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 1

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}

# -----------------------------------------------------------------------------
# IDENTITY POOL
# Exchanges JWT tokens for temporary AWS credentials
# Supports both authenticated (admin) and unauthenticated (guest) access
# -----------------------------------------------------------------------------
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${local.name_prefix}-identity-pool"
  allow_unauthenticated_identities = true  # guests don't need to log in

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.admin.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# IAM ROLES — attached to Identity Pool
# -----------------------------------------------------------------------------

# Guest role — read-only S3 access
resource "aws_iam_role" "guest" {
  name = "${local.name_prefix}-cognito-guest-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = "cognito-identity.amazonaws.com"
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
        }
        "ForAnyValue:StringLike" = {
          "cognito-identity.amazonaws.com:amr" = "unauthenticated"
        }
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "guest" {
  name = "${local.name_prefix}-guest-policy"
  role = aws_iam_role.guest.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${var.menu_assets_bucket_arn}/*"
      }
    ]
  })
}

# Admin role — full app access
resource "aws_iam_role" "admin" {
  name = "${local.name_prefix}-cognito-admin-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = "cognito-identity.amazonaws.com"
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
        }
        "ForAnyValue:StringLike" = {
          "cognito-identity.amazonaws.com:amr" = "authenticated"
        }
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "admin" {
  name = "${local.name_prefix}-admin-policy"
  role = aws_iam_role.admin.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${var.menu_assets_bucket_arn}/*"
      }
    ]
  })
}

# Attach IAM roles to Identity Pool
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    authenticated   = aws_iam_role.admin.arn
    unauthenticated = aws_iam_role.guest.arn
  }
}
