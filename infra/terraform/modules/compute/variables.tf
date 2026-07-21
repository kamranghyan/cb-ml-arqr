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

variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "lambdas_src_path" {
  description = "Absolute path to src/lambdas directory"
  type        = string
}

# ADD THIS CODE SNIPPET TO THE BOTTOM OF THE FILE:
variable "lambdas" {
  description = "Map of lambda functions"
  type        = map(any)
}
