# =============================================================================
# DEV ENVIRONMENT — VARIABLES
# =============================================================================

variable "aws_region" {
  type    = string
  default = "ap-aouth-1"
}

variable "aws_access_key" {
  type      = string
  sensitive = true
}

variable "aws_secret_key" {
  type      = string
  sensitive = true
}

variable "prefix" {
  type    = string
  default = "cb-ml"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "owner" {
  type    = string
  default = "cb-ml-team"
}

# --- Secrets (set via environment variables — never commit real values) ------

variable "api_key" {
  type      = string
  sensitive = true
}

variable "cognito_user_pool_id" {
  type      = string
  sensitive = true
  default   = "PLACEHOLDER"
}

variable "cognito_client_id" {
  type      = string
  sensitive = true
  default   = "PLACEHOLDER"
}

# --- Config ------------------------------------------------------------------

variable "allowed_origins" {
  type    = string
  default = "*"
}

variable "callback_urls" {
  type    = list(string)
  default = ["http://localhost:3000/callback"]
}

variable "logout_urls" {
  type    = list(string)
  default = ["http://localhost:3000/logout"]
}

# --- CDN / Domain (optional for MVP) ----------------------------------------

variable "domain_name" {
  type    = string
  default = ""
}

variable "acm_cert_arn" {
  type    = string
  default = ""
}

variable "route53_zone_id" {
  type    = string
  default = ""
}