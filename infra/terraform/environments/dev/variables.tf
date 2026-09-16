# =============================================================================
# DEV ENVIRONMENT — VARIABLES
# =============================================================================

variable "aws_region" {
  description = "AWS region for all environment resources. Edge resources (WAF/ACM for CloudFront) always use us-east-1 separately, regardless of this value."
  type        = string
  default     = "ap-south-1"
}

variable "aws_access_key" {
  description = "AWS access key used by both the default (ap-south-1) and us-east-1 providers. Set via TF_VAR_aws_access_key — never commit a real value."
  type        = string
  sensitive   = true
}

variable "aws_secret_key" {
  description = "AWS secret key used by both the default (ap-south-1) and us-east-1 providers. Set via TF_VAR_aws_secret_key — never commit a real value."
  type        = string
  sensitive   = true
}

variable "prefix" {
  description = "Short project prefix used in all resource names, following cb-ml-{environment}-{resource}."
  type        = string
  default     = "cb-ml"
}

variable "environment" {
  description = "Deployment environment name. Used in resource naming and tagging."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "owner" {
  description = "Team or individual responsible for these resources. Used in default tags."
  type        = string
  default     = "cb-ml-team"
}

# --- Secrets (set via environment variables — never commit real values) ------

variable "api_key" {
  description = "Internal API key stored in SSM by the secrets module. Set via TF_VAR_api_key."
  type        = string
  sensitive   = true
}

variable "cognito_user_pool_id" {
  description = "Declared for backward compatibility only — currently unused in this root module. The secrets module actually receives its Cognito user pool ID from module.auth.user_pool_id, not from this variable. Safe to delete once you confirm nothing else references it."
  type        = string
  sensitive   = true
  default     = "PLACEHOLDER"
}

variable "cognito_client_id" {
  description = "Declared for backward compatibility only — currently unused in this root module. The secrets module actually receives its Cognito client ID from module.auth.admin_client_id, not from this variable. Safe to delete once you confirm nothing else references it."
  type        = string
  sensitive   = true
  default     = "PLACEHOLDER"
}

# --- Config ------------------------------------------------------------------

variable "allowed_origins" {
  description = "CORS allowed origins, stored in SSM for Lambdas to read. '*' for MVP — tighten before staging/prod."
  type        = string
  default     = "*"
}

variable "callback_urls" {
  description = "Cognito Hosted UI callback URLs for the admin app."
  type        = list(string)
  default     = ["http://localhost:3000/callback"]
}

variable "logout_urls" {
  description = "Cognito Hosted UI logout URLs for the admin app."
  type        = list(string)
  default     = ["http://localhost:3000/logout"]
}

# --- CDN / Domain (optional for MVP) ----------------------------------------

variable "domain_name" {
  description = "Custom domain for CloudFront, e.g. app.cognitobay.com. Leave empty (default) to use the default CloudFront URL — matches enable_custom_domain = false behavior."
  type        = string
  default     = ""
}

variable "acm_cert_arn" {
  description = "ACM certificate ARN (must be issued in us-east-1) for the custom domain. Required only once domain_name is set."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for the custom domain. Required only once domain_name is set."
  type        = string
  default     = ""
}

variable "enable_direct_s3_hosting" {
  description = "TEMPORARY testing toggle — see modules/data/variables.tf."
  type        = bool
  default     = false
}
