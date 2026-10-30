variable "prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "owner" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "lambdas_src_path" {
  description = "Path to src/lambdas/, resolved relative to this module's own path (path.module) so it doesn't depend on the caller's working directory."
  type        = string
}

variable "menu_assets_bucket_name" {
  description = "From module.data — used by menu_svc for S3_BUCKET / ASSET_BUCKET_NAME."
  type        = string
}

variable "ar_models_bucket_name" {
  description = "From module.data — used by ar_svc for ASSET_BUCKET_NAME."
  type        = string
}

variable "connection_table_name" {
  type = string
}
variable "connection_table_arn" {
  type = string
}
variable "ws_order_subscriptions_table_name" {
  type = string
}
variable "ws_order_subscriptions_table_arn" {
  type = string
}

variable "cognito_user_pool_id" {
  description = "From module.auth."
  type        = string
}

variable "cognito_admin_client_id" {
  description = "From module.auth."
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "From module.auth — used to scope each service's Cognito IAM policy."
  type        = string
}

variable "order_table_stream_arn" {
  type = string
}