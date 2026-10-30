# =============================================================================
# NOTIF_SVC — SQS-triggered notification dispatcher (SNS + WebSocket push)
# Self-contained: unlike glb_svc/ws_svc Phase B, nothing here waits on
# anything else. Deploying NotificationsQueue also unblocks the deferred
# ws_svc OrderStateMachine (Phase B), which publishes to this exact queue.
# =============================================================================

resource "aws_sns_topic" "order_notifications" {
  name = "${local.name_prefix}-order-notifications"
  tags = local.common_tags
}

resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "${local.name_prefix}-notifications-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = local.common_tags
}

resource "aws_sqs_queue" "notifications" {
  name                       = "${local.name_prefix}-notifications-queue"
  visibility_timeout_seconds = 70 # must exceed the Lambda's 60s timeout
  message_retention_seconds  = 86400 # 1 day

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount      = 3
  })

  tags = local.common_tags
}

data "archive_file" "notif_svc" {
  type        = "zip"
  source_dir  = "${var.lambdas_src_path}/notif_svc"
  output_path = "${path.module}/build/notif_svc.zip"
  excludes    = ["tests", "scripts", "samconfig.toml", "README.md", ".gitignore", ".env.example", "order-workflow-definition.json", "order-workflow-definition-test.json"]
}

resource "aws_iam_role" "notif_svc" {
  name = "${local.name_prefix}-notif-svc-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "notif_svc_basic_exec" {
  role       = aws_iam_role.notif_svc.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "notif_svc" {
  name = "${local.name_prefix}-notif-svc-policy"
  role = aws_iam_role.notif_svc.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.order_notifications.arn
      },
      {
        # order_svc's real table — still the wrong schema until the Data
        # Layer step, so reads here will fail until then, same as elsewhere.
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:BatchGetItem"]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${local.name_prefix}-order",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${local.name_prefix}-order/index/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Query", "dynamodb:Scan", "dynamodb:DeleteItem"]
        Resource = [
          var.connection_table_arn,
          "${var.connection_table_arn}/index/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.notifications.arn
      },
      {
        Effect   = "Allow"
        Action   = ["execute-api:ManageConnections"]
        Resource = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.ws.id}/*/@connections/*"
      },
      {
        # Harmless if PINPOINT_APP_ID stays unset — matches the template,
        # which grants this unconditionally too.
        Effect   = "Allow"
        Action   = ["mobiletargeting:SendMessages"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "notif_svc" {
  name              = "/aws/lambda/${local.name_prefix}-notif-svc"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_lambda_function" "notif_svc" {
  function_name = "${local.name_prefix}-notif-svc"
  role          = aws_iam_role.notif_svc.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 60

  filename         = data.archive_file.notif_svc.output_path
  source_code_hash = data.archive_file.notif_svc.output_base64sha256

  environment {
    variables = {
      STAGE                = var.environment
      SNS_TOPIC            = aws_sns_topic.order_notifications.arn
      WS_ENDPOINT           = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
      WS_CONNECTIONS_TABLE = var.connection_table_name
      TABLE_ORDER          = "${local.name_prefix}-order"
      PINPOINT_APP_ID      = ""
      PINPOINT_FROM_NUMBER = ""
    }
  }

  depends_on = [aws_iam_role_policy_attachment.notif_svc_basic_exec, aws_cloudwatch_log_group.notif_svc]
  tags       = local.common_tags
}

resource "aws_lambda_event_source_mapping" "notif_svc_sqs" {
  event_source_arn = aws_sqs_queue.notifications.arn
  function_name    = aws_lambda_function.notif_svc.arn
  batch_size       = 10
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_cloudwatch_metric_alarm" "notifications_dlq_not_empty" {
  alarm_name          = "${local.name_prefix}-notifications-dlq-not-empty"
  alarm_description   = "Messages in DLQ — SNS/WebSocket push failed after 3 retries"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.notifications_dlq.name }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.admin_alerts.arn] # reusing glb_svc's ops-alerts topic — SAM template had no action wired at all

  tags = local.common_tags
}