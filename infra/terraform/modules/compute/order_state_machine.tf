# =============================================================================
# ORDER STATE MACHINE — ws_svc Phase B
# Based on the Choice/Notify design embedded in ws_svc's template.yaml, NOT
# notif_svc/order-workflow-definition.json — that file's Lambda-invoking
# Wait/Choice design assumes one persistent execution per order, but
# order_svc actually starts a FRESH execution on every status change with a
# static snapshot as input (see sfn_service.py), and its Lambda handler has
# no branch for a direct Step-Functions-shaped invoke anyway (Mangum expects
# an API Gateway event). So: one snapshot in, one Choice, one SQS notify out.
# =============================================================================

resource "aws_iam_role" "order_state_machine" {
  name = "${local.name_prefix}-order-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "order_state_machine" {
  name = "${local.name_prefix}-order-sfn-policy"
  role = aws_iam_role.order_state_machine.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sqs:SendMessage"]
      Resource = aws_sqs_queue.notifications.arn
    }]
  })
}

locals {
  # Every Notify* task shares this shape — only status/message differ.
  order_notify_fields = {
    "orderId.$"          = "$.orderId"
    "tenantId.$"         = "$.tenantId"
    "restaurantId.$"     = "$.restaurantId"
    "guestConnectionId.$" = "$.guestConnectionId"
    "guestSessionId.$"   = "$.guestSessionId"
  }

  order_notify_states = {
    NotifyCancelled = { status = "CANCELLED", message = "Your order has been cancelled." }
    NotifyDelivered = { status = "DELIVERED", message = "Your order has been delivered." }
    NotifyReady     = { status = "READY", message = "Your order is ready." }
    NotifyPreparing = { status = "PREPARING", message = "Your order is being prepared." }
    NotifyReceived  = { status = "RECEIVED", message = "Your order has been received." }
  }
}

resource "aws_sfn_state_machine" "order_workflow" {
  name     = "${local.name_prefix}-order-workflow"
  role_arn = aws_iam_role.order_state_machine.arn

  definition = jsonencode({
    Comment = "Order notification workflow — one snapshot in, one notify out"
    StartAt = "DetermineStatus"
    States = merge(
      {
        DetermineStatus = {
          Type = "Choice"
          Choices = [
            { Variable = "$.cancelled", BooleanEquals = true, Next = "NotifyCancelled" },
            { Variable = "$.delivered", BooleanEquals = true, Next = "NotifyDelivered" },
            { Variable = "$.foodReady", BooleanEquals = true, Next = "NotifyReady" },
            { Variable = "$.kitchenAccepted", BooleanEquals = true, Next = "NotifyPreparing" },
          ]
          Default = "NotifyReceived"
        }
        OrderSuccess = { Type = "Succeed" }
      },
      {
        for name, s in local.order_notify_states : name => {
          Type     = "Task"
          Resource = "arn:aws:states:::sqs:sendMessage"
          Parameters = {
            QueueUrl    = aws_sqs_queue.notifications.url
            MessageBody = merge(local.order_notify_fields, {
              status  = s.status
              message = s.message
            })
          }
          Retry = [{ ErrorEquals = ["States.ALL"], MaxAttempts = 2, IntervalSeconds = 2 }]
          Next  = "OrderSuccess"
        }
      }
    )
  })

  tags = local.common_tags
}

# =============================================================================
# ws_order_created — DynamoDB Stream (INSERT only) on the real order table.
# Was blocked on the Data Layer step for the table's stream ARN; unblocked now.
# =============================================================================

data "archive_file" "ws_order_created" {
  type        = "zip"
  source_dir  = "${var.lambdas_src_path}/ws_svc/functions/ws_order_created"
  output_path = "${path.module}/build/ws_order_created.zip"
}

resource "aws_iam_role_policy" "ws_order_created_stream" {
  name = "${local.name_prefix}-ws-order-created-stream-policy"
  role = aws_iam_role.ws_svc.id # reuses ws_svc's existing role — same service, same connection table access already granted

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:DescribeStream", "dynamodb:GetRecords", "dynamodb:GetShardIterator", "dynamodb:ListStreams"]
      Resource = var.order_table_stream_arn
    }]
  })
}

resource "aws_cloudwatch_log_group" "ws_order_created" {
  name              = "/aws/lambda/${local.name_prefix}-ws-order-created"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_lambda_function" "ws_order_created" {
  function_name = "${local.name_prefix}-ws-order-created"
  role          = aws_iam_role.ws_svc.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  architectures = ["arm64"]
  memory_size   = 512
  timeout       = 10
  layers        = [aws_lambda_layer_version.ws_dependencies.arn]

  filename         = data.archive_file.ws_order_created.output_path
  source_code_hash = data.archive_file.ws_order_created.output_base64sha256

  environment {
    variables = {
      TABLE_CONN  = var.connection_table_name
      WS_ENDPOINT = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
    }
  }

  depends_on = [aws_iam_role_policy_attachment.ws_svc_basic_exec, aws_cloudwatch_log_group.ws_order_created]
  tags       = local.common_tags
}

resource "aws_lambda_event_source_mapping" "ws_order_created_stream" {
  event_source_arn  = var.order_table_stream_arn
  function_name     = aws_lambda_function.ws_order_created.arn
  starting_position = "LATEST"
  batch_size        = 10
  maximum_batching_window_in_seconds = 1

  filter_criteria {
    filter {
      pattern = jsonencode({ eventName = ["INSERT"] })
    }
  }

  depends_on = [aws_iam_role_policy.ws_order_created_stream]
}

resource "aws_iam_role_policy" "order_svc_start_execution" {
  name = "${local.name_prefix}-order-svc-sfn-policy"
  role = aws_iam_role.lambda["order_svc"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["states:StartExecution"]
      Resource = aws_sfn_state_machine.order_workflow.arn
    }]
  })
}