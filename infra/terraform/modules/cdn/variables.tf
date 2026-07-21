# =============================================================================
# CDN MODULE — VARIABLES
# =============================================================================

variable "prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "owner" {
  type    = string
  default = "devops-team"
}

# --- Asset bucket inputs ------------------------------------------------------

variable "menu_assets_bucket_name" {
  type = string
}

variable "menu_assets_bucket_regional_domain" {
  type = string
}

variable "ar_models_bucket_name" {
  type = string
}

variable "ar_models_bucket_regional_domain" {
  type = string
}

# --- UI bucket inputs ---------------------------------------------------------

variable "guest_ui_bucket_name" {
  type = string
}

variable "guest_ui_bucket_regional_domain" {
  type = string
}

variable "kds_ui_bucket_name" {
  type = string
}

variable "kds_ui_bucket_regional_domain" {
  type = string
}

variable "admin_ui_bucket_name" {
  type = string
}

variable "admin_ui_bucket_regional_domain" {
  type = string
}

# --- Domain (optional) --------------------------------------------------------

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

