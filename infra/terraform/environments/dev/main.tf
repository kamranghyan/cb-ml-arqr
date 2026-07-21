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
    bucket  = "cb-ml-arqr-terraform-state-833090513377" 
    key     = "dev/main/terraform.tfstate" 
    region  = "ap-south-1" 
    encrypt = true 
  } # <-- Make sure this closing brace for backend "s3" exists!
} # <-- Make sure this closing brace for terraform exists!

provider "aws" { 
  region     = var.aws_region 
  access_key = var.aws_access_key 
  secret_key = var.aws_secret_key 
}

# ... the rest of your modules (data, secrets, etc.) can remain exactly as they were


# -----------------------------------------------------------------------------
# Step 5 — DATA MODULE
# -----------------------------------------------------------------------------
module "data" {
  source      = "../../modules/data"
  prefix      = var.prefix
  environment = var.environment
  owner       = var.owner
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
}

# -----------------------------------------------------------------------------
# Step 11 — COMPUTE MODULE
# -----------------------------------------------------------------------------
module "compute" {
  source           = "../../modules/compute"
  prefix           = var.prefix
  environment      = var.environment
  owner            = var.owner
  aws_region       = var.aws_region
  lambdas_src_path = "${path.root}/../../../../src/lambdas"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}