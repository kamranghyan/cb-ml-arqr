# =============================================================================
# BOOTSTRAP — OUTPUTS
# Copy these values into every environment's backend.tf
# =============================================================================

output "state_bucket_name" {
  description = "S3 bucket name for Terraform remote state. Use as 'bucket' in backend config."
  value       = aws_s3_bucket.terraform_state.id
}

output "state_bucket_arn" {
  description = "ARN of the state bucket. Use in TerraformExecutionRole IAM policy (Step 3)."
  value       = aws_s3_bucket.terraform_state.arn
}

output "lock_table_name" {
  description = "DynamoDB table name for state locking. Use as 'dynamodb_table' in backend config."
  value       = aws_dynamodb_table.terraform_locks.name
}

output "lock_table_arn" {
  description = "ARN of the lock table. Use in TerraformExecutionRole IAM policy (Step 3)."
  value       = aws_dynamodb_table.terraform_locks.arn
}

output "aws_region" {
  description = "Region where state resources are deployed."
  value       = local.region
}

output "logs_bucket_name" {
  description = "S3 bucket name for state access logs."
  value       = aws_s3_bucket.state_logs.id
}

output "backend_config_snippet" {
  description = "Copy-paste this into each environment's backend.tf (replace KEY_PATH)"
  value       = <<-EOT
    terraform {
      backend "s3" {
        bucket         = "${aws_s3_bucket.terraform_state.id}"
        key            = "KEY_PATH/terraform.tfstate"
        region         = "${local.region}"
        dynamodb_table = "${aws_dynamodb_table.terraform_locks.name}"
        encrypt        = true
      }
    }
  EOT
}
