output "api_gateway_url" {
  description = "Base URL for all API endpoints — use in frontend HTML"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "api_gateway_id" {
  value = aws_api_gateway_rest_api.main.id
}

output "lambda_function_names" {
  value = { for k, v in aws_lambda_function.this : k => v.function_name }
}
