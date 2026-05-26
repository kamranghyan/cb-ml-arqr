# =============================================================================
# DEV ENVIRONMENT
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "cb-ml-arqr-terraform-state-833090513377"
    key          = "dev/main/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region     = var.aws_region
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

# WAF for CloudFront MUST be in us-east-1 — required by AWS
provider "aws" {
  alias      = "us_east_1"
  region     = "us-east-1"
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

# -----------------------------------------------------------------------------
# DATA MODULE (Step 5)
# -----------------------------------------------------------------------------
module "data" {
  source      = "../../modules/data"
  prefix      = var.prefix
  environment = var.environment
  owner       = var.owner
}

# -----------------------------------------------------------------------------
# Step 6 — SECRETS MODULE
# Cognito values auto-populated from auth module outputs below
# -----------------------------------------------------------------------------
module "secrets" {
  source      = "../../modules/secrets"
  prefix      = var.prefix
  environment = var.environment
  owner       = var.owner

  api_key              = var.api_key
  cognito_user_pool_id = module.auth.user_pool_id    # auto-wired from auth
  cognito_client_id    = module.auth.admin_client_id # auto-wired from auth
  menu_assets_bucket   = module.data.bucket_menu_assets
  allowed_origins      = var.allowed_origins
}

# -----------------------------------------------------------------------------
# Step 7 — AUTH MODULE
# -----------------------------------------------------------------------------
module "auth" {
  source      = "../../modules/auth"
  prefix      = var.prefix
  environment = var.environment
  owner       = var.owner

  menu_assets_bucket_arn = module.data.bucket_menu_assets_arn
  callback_urls          = var.callback_urls
  logout_urls            = var.logout_urls
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

  # S3 origins — wired from data module
  menu_assets_bucket_name            = module.data.bucket_menu_assets
  menu_assets_bucket_regional_domain = module.data.bucket_menu_assets_regional_domain
  ar_models_bucket_name              = module.data.bucket_ar_models_name
  ar_models_bucket_regional_domain   = module.data.bucket_ar_models_regional_domain

  # Domain — empty for MVP, fill in when domain purchased
  domain_name     = var.domain_name
  acm_cert_arn    = var.acm_cert_arn
  route53_zone_id = var.route53_zone_id
}

# -----------------------------------------------------------------------------
# Step 9 — OBSERVABILITY MODULE
# -----------------------------------------------------------------------------
module "observability" {
  source      = "../../modules/observability"
  prefix      = var.prefix
  environment = var.environment
  owner       = var.owner

  log_retention_days = 14  # 14 days for dev
}