# =============================================================================
# BOOTSTRAP — VARIABLES
# =============================================================================

variable "aws_region" {
  description = "AWS region for the state bucket and lock table"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short project identifier used in all resource names. Lowercase, no spaces."
  type        = string
  default     = "cb-ml-arqr"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,10}$", var.project_name))
    error_message = "project_name must be lowercase alphanumeric with hyphens, 2–11 chars."
  }
}

variable "owner" {
  description = "CognitoBay team"
  type        = string
  default     = "cb-ml-team"
}
