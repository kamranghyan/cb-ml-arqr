# =============================================================================
# SECRETS MODULE — VARIABLES
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

# --- Sensitive values (marked sensitive — never shown in plan output) --------

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID — filled after auth module is deployed (Step 7)"
  type        = string
  sensitive   = true
  default     = "PLACEHOLDER"
}

variable "cognito_client_id" {
  description = "Cognito App Client ID — filled after auth module is deployed (Step 7)"
  type        = string
  sensitive   = true
  default     = "PLACEHOLDER"
}

variable "api_key" {
  description = "Internal API key for service-to-service auth"
  type        = string
  sensitive   = true
}

# --- Non-sensitive config ----------------------------------------------------

variable "allowed_origins" {
  description = "Comma-separated CORS origins e.g. https://dev.example.com"
  type        = string
  default     = "*"
}

variable "menu_assets_bucket" {
  description = "S3 bucket name from data module output"
  type        = string
}
