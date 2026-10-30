# =============================================================================
# DEV ENVIRONMENT
# =============================================================================
terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend config lives in backend.tf, not here — see that file.
}

# -----------------------------------------------------------------------------
# Default provider — ap-south-1, used by every module unless it explicitly
# requests the us_east_1 alias below. Credentials come from the same
# TF_VAR_aws_access_key / TF_VAR_aws_secret_key used everywhere else in this
# environment (see variables.tf and the CI workflow) so local runs and CI
# authenticate the same way.
# -----------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.prefix
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = var.owner
    }
  }
}

# The aliased provider for edge services (Virginia) — required for WAF/ACM
# resources used by the CDN module, which must live in us-east-1.
provider "aws" {
  alias  = "us_east_1" # <-- MUST match the alias string exactly
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.prefix
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = var.owner
    }
  }
}

# -----------------------------------------------------------------------------
# Step 5 — DATA MODULE
# -----------------------------------------------------------------------------
module "data" {
  source      = "../../modules/data"
  prefix      = var.prefix
  environment = var.environment
  owner       = var.owner
  enable_direct_s3_hosting = var.enable_direct_s3_hosting   # add this line


  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

# -----------------------------------------------------------------------------
# Step 6 — SECRETS MODULE
# -----------------------------------------------------------------------------
module "secrets" {
  source               = "../../modules/secrets"
  prefix               = var.prefix
  environment          = var.environment
  owner                = var.owner
  api_key              = var.api_key
  cognito_user_pool_id = module.auth.user_pool_id
  cognito_client_id    = module.auth.admin_client_id
  menu_assets_bucket   = module.data.bucket_menu_assets
  allowed_origins      = var.allowed_origins

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

# -----------------------------------------------------------------------------
# Step 7 — AUTH MODULE
# -----------------------------------------------------------------------------
module "auth" {
  source                 = "../../modules/auth"
  prefix                 = var.prefix
  environment            = var.environment
  owner                  = var.owner
  menu_assets_bucket_arn = module.data.bucket_menu_assets_arn
  callback_urls          = var.callback_urls
  logout_urls            = var.logout_urls

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

# -----------------------------------------------------------------------------
# Step 8 — CDN MODULE
# -----------------------------------------------------------------------------
module "cdn" {
  source      = "../../modules/cdn"
  prefix      = var.prefix
  environment = var.environment
  owner       = var.owner

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  # Asset origins
  menu_assets_bucket_name            = module.data.bucket_menu_assets
  menu_assets_bucket_regional_domain = module.data.bucket_menu_assets_regional_domain
  ar_models_bucket_name              = module.data.bucket_ar_models_name
  ar_models_bucket_regional_domain   = module.data.bucket_ar_models_regional_domain

  # UI origins
  guest_ui_bucket_name            = module.data.bucket_guest_ui_name
  guest_ui_bucket_regional_domain = module.data.bucket_guest_ui_regional_domain
  kds_ui_bucket_name              = module.data.bucket_kds_ui_name
  kds_ui_bucket_regional_domain   = module.data.bucket_kds_ui_regional_domain
  admin_ui_bucket_name            = module.data.bucket_admin_ui_name
  admin_ui_bucket_regional_domain = module.data.bucket_admin_ui_regional_domain

  # Domain — empty for MVP
  domain_name     = var.domain_name
  acm_cert_arn    = var.acm_cert_arn
  route53_zone_id = var.route53_zone_id
}

# -----------------------------------------------------------------------------
# Step 9 — OBSERVABILITY MODULE
# -----------------------------------------------------------------------------
module "observability" {
  source             = "../../modules/observability"
  prefix             = var.prefix
  environment        = var.environment
  owner              = var.owner
  log_retention_days = 14

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

# -----------------------------------------------------------------------------
# Step 11 — COMPUTE MODULE
# NOTE: this module still targets the old mock lambdas (menu-service,
# order-service, ...), which no longer exist in src/lambdas/. Left untouched
# in this step on purpose — it gets rebuilt wholesale in the Compute step
# against the real *_svc services. Don't deploy this module's changes yet.
# -----------------------------------------------------------------------------
module "compute" {
  source      = "../../modules/compute"
  prefix      = var.prefix
  environment = var.environment
  owner       = var.owner
  aws_region  = var.aws_region

  lambdas_src_path = "${path.module}/../../../../src/lambdas"

  menu_assets_bucket_name = module.data.bucket_menu_assets
  ar_models_bucket_name   = module.data.bucket_ar_models_name

  cognito_user_pool_id    = module.auth.user_pool_id
  cognito_admin_client_id = module.auth.admin_client_id
  cognito_user_pool_arn   = module.auth.user_pool_arn

  connection_table_name             = module.data.connection_table_name
  connection_table_arn              = module.data.connection_table_arn
  ws_order_subscriptions_table_name = module.data.ws_order_subscriptions_table_name
  ws_order_subscriptions_table_arn  = module.data.ws_order_subscriptions_table_arn

  order_table_stream_arn = module.data.order_table_stream_arn

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}