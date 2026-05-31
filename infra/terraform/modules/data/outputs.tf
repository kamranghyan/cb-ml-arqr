# =============================================================================
# DATA MODULE — OUTPUTS
# =============================================================================

# DynamoDB table names
output "menu_table_name" {
  value = aws_dynamodb_table.menu.name
}

output "order_table_name" {
  value = aws_dynamodb_table.order.name
}

output "tenant_table_name" {
  value = aws_dynamodb_table.tenant.name
}

output "connection_table_name" {
  value = aws_dynamodb_table.connection.name
}

output "dynamodb_table_arns" {
  value = [
    aws_dynamodb_table.menu.arn,
    aws_dynamodb_table.order.arn,
    aws_dynamodb_table.tenant.arn,
    aws_dynamodb_table.connection.arn,
  ]
}

# Asset bucket outputs
output "bucket_menu_assets" {
  value = aws_s3_bucket.this["menu_assets"].id
}

output "bucket_menu_assets_arn" {
  value = aws_s3_bucket.this["menu_assets"].arn
}

output "bucket_menu_assets_regional_domain" {
  value = aws_s3_bucket.this["menu_assets"].bucket_regional_domain_name
}

output "bucket_ar_models_name" {
  value = aws_s3_bucket.this["ar_models"].id
}

output "bucket_ar_models_regional_domain" {
  value = aws_s3_bucket.this["ar_models"].bucket_regional_domain_name
}

output "s3_bucket_arns" {
  value = [for b in aws_s3_bucket.this : b.arn]
}

# UI bucket outputs — name + regional domain (needed by CDN module)
output "bucket_guest_ui_name" {
  value = aws_s3_bucket.this["guest_ui"].id
}

output "bucket_guest_ui_regional_domain" {
  value = aws_s3_bucket.this["guest_ui"].bucket_regional_domain_name
}

output "bucket_kds_ui_name" {
  value = aws_s3_bucket.this["kds_ui"].id
}

output "bucket_kds_ui_regional_domain" {
  value = aws_s3_bucket.this["kds_ui"].bucket_regional_domain_name
}

output "bucket_admin_ui_name" {
  value = aws_s3_bucket.this["admin_ui"].id
}

output "bucket_admin_ui_regional_domain" {
  value = aws_s3_bucket.this["admin_ui"].bucket_regional_domain_name
}
