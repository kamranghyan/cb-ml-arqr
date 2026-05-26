output "log_group_names" {
  description = "Map of Lambda name to its CloudWatch log group name"
  value       = { for k, v in aws_cloudwatch_log_group.lambda : k => v.name }
}

output "log_group_arns" {
  description = "Map of Lambda name to its CloudWatch log group ARN"
  value       = { for k, v in aws_cloudwatch_log_group.lambda : k => v.arn }
}
