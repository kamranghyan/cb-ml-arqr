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

variable "log_retention_days" {
  description = "Days to retain logs — 14 for dev, 90 for prod"
  type        = number
  default     = 14
}
