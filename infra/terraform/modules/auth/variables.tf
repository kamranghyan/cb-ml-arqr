# =============================================================================
# AUTH MODULE — VARIABLES
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

variable "menu_assets_bucket_arn" {
  description = "ARN of the menu assets S3 bucket — from data module output"
  type        = string
}

variable "callback_urls" {
  description = "Allowed callback URLs for admin app client (OAuth)"
  type        = list(string)
  default     = ["http://localhost:3000/callback"]
}

variable "logout_urls" {
  description = "Allowed logout URLs for admin app client"
  type        = list(string)
  default     = ["http://localhost:3000/logout"]
}
