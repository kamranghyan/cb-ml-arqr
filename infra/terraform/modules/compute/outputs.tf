output "lambda_function_names" {
  value = { for k, v in aws_lambda_function.this : k => v.function_name }
}

output "lambda_function_arns" {
  value = { for k, v in aws_lambda_function.this : k => v.arn }
}

output "lambda_invoke_arns" {
  description = "For wiring up API Gateway in the next step"
  value       = { for k, v in aws_lambda_function.this : k => v.invoke_arn }
}

output "shared_layer_arn" {
  value = aws_lambda_layer_version.shared.arn
}

output "glb_svc_function_arn" {
  value = aws_lambda_function.glb_svc.arn
}

output "admin_alerts_topic_arn" {
  value = aws_sns_topic.admin_alerts.arn
}

output "websocket_url" {
  value = "wss://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "notifications_queue_url" {
  value = aws_sqs_queue.notifications.url
}

output "notifications_queue_arn" {
  value = aws_sqs_queue.notifications.arn
}

output "order_notifications_topic_arn" {
  value = aws_sns_topic.order_notifications.arn
}

output "order_state_machine_arn" {
  value = aws_sfn_state_machine.order_workflow.arn
}

output "api_urls" {
  description = "Base invoke URL per service — append the actual app route to these"
  value = {
    for k, v in aws_api_gateway_stage.this :
    k => "https://${aws_api_gateway_rest_api.this[k].id}.execute-api.${var.aws_region}.amazonaws.com/${v.stage_name}"
  }
}