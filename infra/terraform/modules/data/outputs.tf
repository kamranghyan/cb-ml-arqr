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

# S3 bucket names — using try() to avoid errors during partial imports
output "bucket_menu_assets" {
  value = try(aws_s3_bucket.this["menu_assets"].id, "")
}

output "bucket_menu_assets_arn" {
  value = try(aws_s3_bucket.this["menu_assets"].arn, "")
}

output "bucket_menu_assets_regional_domain" {
  value = try(aws_s3_bucket.this["menu_assets"].bucket_regional_domain_name, "")
}

output "bucket_ar_models" {
  value = try(aws_s3_bucket.this["ar_models"].id, "")
}

output "bucket_ar_models_name" {
  value = try(aws_s3_bucket.this["ar_models"].id, "")
}

output "bucket_ar_models_regional_domain" {
  value = try(aws_s3_bucket.this["ar_models"].bucket_regional_domain_name, "")
}

output "bucket_analytics_archive" {
  value = try(aws_s3_bucket.this["analytics_archive"].id, "")
}

output "bucket_logs" {
  value = try(aws_s3_bucket.this["logs"].id, "")
}

output "s3_bucket_arns" {
  value = [for b in aws_s3_bucket.this : b.arn]
}
