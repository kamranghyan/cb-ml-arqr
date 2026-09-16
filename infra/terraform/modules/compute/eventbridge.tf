# =============================================================================
# EVENTBRIDGE — payment.succeeded: pay_svc (producer) -> subs_svc's second
# function (consumer). Reuses subs_svc's existing package/role/layer — same
# CodeUri, same app, just a different handler entry point.
# =============================================================================

resource "aws_cloudwatch_event_bus" "main" {
  name = "${local.name_prefix}-events"
  tags = local.common_tags
}

# --- pay_svc needs events:PutEvents, which it didn't have before -----------

resource "aws_iam_role_policy" "pay_svc_eventbridge" {
  name = "${local.name_prefix}-pay-svc-eventbridge-policy"
  role = aws_iam_role.lambda["pay_svc"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["events:PutEvents"]
      Resource = aws_cloudwatch_event_bus.main.arn
    }]
  })
}

# --- subs_svc's second function: PaymentSucceededEventHandler --------------

resource "aws_lambda_function" "subs_payment_event_handler" {
  function_name = "${local.name_prefix}-subs-payment-event-handler"
  role          = aws_iam_role.lambda["subs_svc"].arn # reuses subs_svc's role — already has TenantTable + TenantSubscriptionTable access
  handler       = "app.events.payment_handler.handle_payment_succeeded"
  runtime       = "python3.12"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 60
  layers        = [aws_lambda_layer_version.shared.arn]

  # Same source as the main subs_svc function — no separate build needed.
  filename         = data.archive_file.function["subs_svc"].output_path
  source_code_hash = data.archive_file.function["subs_svc"].output_base64sha256

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      LOG_LEVEL            = "INFO"
      TENANT_TABLE         = "${local.name_prefix}-tenant"
      SUBSCRIPTION_TABLE   = "${local.name_prefix}-tenant-subscription"
    }
  }

  depends_on = [aws_iam_role_policy_attachment.basic_exec, aws_cloudwatch_log_group.subs_payment_event_handler]
  tags       = local.common_tags
}

resource "aws_cloudwatch_log_group" "subs_payment_event_handler" {
  name              = "/aws/lambda/${local.name_prefix}-subs-payment-event-handler"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_event_rule" "payment_succeeded" {
  name           = "${local.name_prefix}-payment-succeeded"
  event_bus_name = aws_cloudwatch_event_bus.main.name

  event_pattern = jsonencode({
    source      = ["app.payment_svc"]
    detail-type = ["payment.succeeded"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "payment_succeeded_to_subs" {
  rule           = aws_cloudwatch_event_rule.payment_succeeded.name
  event_bus_name = aws_cloudwatch_event_bus.main.name
  arn            = aws_lambda_function.subs_payment_event_handler.arn
}

resource "aws_lambda_permission" "eventbridge_invoke_subs_payment_handler" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.subs_payment_event_handler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.payment_succeeded.arn
}