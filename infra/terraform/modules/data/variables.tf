# =============================================================================
# DATA MODULE — VARIABLES
# =============================================================================

variable "prefix" {
  description = "Project prefix for all resource names e.g. cb-ml"
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
  description = "CognitoBay"
  type        = string
  default     = "cb-ml-team"
}

locals {
  common_tags = {
    Project     = var.prefix
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
  }
}
