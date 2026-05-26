# =============================================================================
# CDN MODULE — VARIABLES
# =============================================================================

variable "prefix" {
  description = "Project prefix e.g. cb-ml"
  type        = string
}

variable "environment" {
  description = "Deployment environment: dev | staging | prod"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "owner" {
  description = "Team owner tag"
  type        = string
  default     = "cb-ml-team"
}

# --- S3 Origins --------------------------------------------------------------

variable "menu_assets_bucket_name" {
  description = "S3 bucket name for menu assets — from data module output"
  type        = string
}

variable "menu_assets_bucket_regional_domain" {
  description = "Regional domain name of menu assets bucket e.g. bucket.s3.us-east-1.amazonaws.com"
  type        = string
}

variable "ar_models_bucket_name" {
  description = "S3 bucket name for AR models — from data module output"
  type        = string
}

variable "ar_models_bucket_regional_domain" {
  description = "Regional domain name of AR models bucket"
  type        = string
}

# --- Domain (optional — leave empty for MVP) ---------------------------------

variable "domain_name" {
  description = "Custom domain e.g. menu.yourapp.com — leave empty for MVP"
  type        = string
  default     = ""
}

variable "acm_cert_arn" {
  description = "ACM certificate ARN (must be in us-east-1) — leave empty for MVP"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID — leave empty for MVP"
  type        = string
  default     = ""
}

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.us_east_1]
    }
  }
}
