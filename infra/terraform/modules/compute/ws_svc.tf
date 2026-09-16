# =============================================================================
# WS_SVC — WebSocket API (Phase A: connect / disconnect / message)
# Deferred to a later step (needs infra that doesn't exist yet):
#   - ws_order_created (needs DynamoDB Streams on order_svc's real Orders
#     table — that table doesn't have the right schema yet, Data Layer step)
#   - OrderStateMachine (publishes to notifications-queue-{stage}, which
#     belongs to notif_svc — not built yet)
#   - order_svc's STEP_ARN currently = "none"; once the state machine above
#     exists, order_svc needs states:StartExecution IAM + its real ARN
# =============================================================================

resource "aws_sqs_queue" "order_dlq" {
  name                      = "${local.name_prefix}-order-dlq.fifo"
  fifo_queue                = true
  content_based_deduplication = true
  message_retention_seconds = 1209600 # 14 days, matches template default

  tags = local.common_tags
}

# --- Dependencies layer (redis, PyJWT, boto3 — pure Python, arm64 is fine) --

resource "null_resource" "ws_layer_build" {
  triggers = {
    requirements_hash = filemd5("${var.lambdas_src_path}/ws_svc/layer/requirements.txt")
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      rm -rf "${path.module}/build/ws_layer"
      mkdir -p "${path.module}/build/ws_layer/python"
      python3 -m pip install \
        -r "${var.lambdas_src_path}/ws_svc/layer/requirements.txt" \
        -t "${path.module}/build/ws_layer/python" \
        --platform manylinux2014_aarch64 \
        --python-version 3.12 \
        --implementation cp \
        --only-binary=:all: \
        --upgrade
    EOT
  }
}

data "archive_file" "ws_layer" {
  type        = "zip"
  source_dir  = "${path.module}/build/ws_layer"
  output_path = "${path.module}/build/ws_layer.zip"
  depends_on  = [null_resource.ws_layer_build]
}

resource "aws_lambda_layer_version" "ws_dependencies" {
  layer_name               = "${local.name_prefix}-ws-dependencies"
  description               = "ws_svc layer — redis, PyJWT, boto3"
  filename                  = data.archive_file.ws_layer.output_path
  source_code_hash          = data.archive_file.ws_layer.output_base64sha256
  compatible_runtimes       = ["python3.12"]
  compatible_architectures  = ["arm64"]
}

# --- Per-function packaging (no pip deps of their own — layer covers it) ---

data "archive_file" "ws_connect" {
  type        = "zip"
  source_dir  = "${var.lambdas_src_path}/ws_svc/functions/ws_connect"
  output_path = "${path.module}/build/ws_connect.zip"
}

data "archive_file" "ws_disconnect" {
  type        = "zip"
  source_dir  = "${var.lambdas_src_path}/ws_svc/functions/ws_disconnect"
  output_path = "${path.module}/build/ws_disconnect.zip"
}

data "archive_file" "ws_message" {
  type        = "zip"
  source_dir  = "${var.lambdas_src_path}/ws_svc/functions/ws_message"
  output_path = "${path.module}/build/ws_message.zip"
}

# --- IAM — one role for the 3 Phase-A functions (matches the SAM template's
#     own single-role design for this service) ---------------------------

resource "aws_iam_role" "ws_svc" {
  name = "${local.name_prefix}-ws-svc-role"

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

resource "aws_iam_role_policy_attachment" "ws_svc_basic_exec" {
  role       = aws_iam_role.ws_svc.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "ws_svc" {
  name = "${local.name_prefix}-ws-svc-policy"
  role = aws_iam_role.ws_svc.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem", "dynamodb:Query", "dynamodb:Scan"]
        Resource = [
          var.connection_table_arn,
          "${var.connection_table_arn}/index/*",
          var.ws_order_subscriptions_table_arn,
          "${var.ws_order_subscriptions_table_arn}/index/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.order_dlq.arn
      },
      {
        Effect   = "Allow"
        Action   = ["execute-api:ManageConnections"]
        Resource = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.ws.id}/*"
      }
    ]
  })
}

# --- Lambda functions -------------------------------------------------------

resource "aws_cloudwatch_log_group" "ws_connect" {
  name              = "/aws/lambda/${local.name_prefix}-ws-connect"
  retention_in_days = 14
  tags              = local.common_tags
}
resource "aws_cloudwatch_log_group" "ws_disconnect" {
  name              = "/aws/lambda/${local.name_prefix}-ws-disconnect"
  retention_in_days = 14
  tags              = local.common_tags
}
resource "aws_cloudwatch_log_group" "ws_message" {
  name              = "/aws/lambda/${local.name_prefix}-ws-message"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_lambda_function" "ws_connect" {
  function_name = "${local.name_prefix}-ws-connect"
  role          = aws_iam_role.ws_svc.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 5
  layers        = [aws_lambda_layer_version.ws_dependencies.arn]

  filename         = data.archive_file.ws_connect.output_path
  source_code_hash = data.archive_file.ws_connect.output_base64sha256

  environment {
    variables = {
      REDIS_URL     = "redis://localhost:6379" # no ElastiCache in MVP
      TABLE_CONN    = var.connection_table_name
      USER_POOL_ID  = var.cognito_user_pool_id
      CLIENT_ID     = var.cognito_admin_client_id # staff/KDS connections carry a token; guests connect via guestSessionId with no token at all
    }
  }

  depends_on = [aws_iam_role_policy_attachment.ws_svc_basic_exec, aws_cloudwatch_log_group.ws_connect]
  tags       = local.common_tags
}

resource "aws_lambda_function" "ws_disconnect" {
  function_name = "${local.name_prefix}-ws-disconnect"
  role          = aws_iam_role.ws_svc.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 5
  layers        = [aws_lambda_layer_version.ws_dependencies.arn]

  filename         = data.archive_file.ws_disconnect.output_path
  source_code_hash = data.archive_file.ws_disconnect.output_base64sha256

  environment {
    variables = {
      REDIS_URL  = "redis://localhost:6379"
      TABLE_CONN = var.connection_table_name
    }
  }

  depends_on = [aws_iam_role_policy_attachment.ws_svc_basic_exec, aws_cloudwatch_log_group.ws_disconnect]
  tags       = local.common_tags
}

resource "aws_lambda_function" "ws_message" {
  function_name = "${local.name_prefix}-ws-message"
  role          = aws_iam_role.ws_svc.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  architectures = ["arm64"]
  memory_size   = 512
  timeout       = 10
  layers        = [aws_lambda_layer_version.ws_dependencies.arn]

  filename         = data.archive_file.ws_message.output_path
  source_code_hash = data.archive_file.ws_message.output_base64sha256

  environment {
    variables = {
      TABLE_ORDER       = var.ws_order_subscriptions_table_name
      TABLE_REAL_ORDERS = "${local.name_prefix}-order" # real order_svc table — wrong schema until Data Layer step, expect lookups to fail until then
      DLQ_URL           = aws_sqs_queue.order_dlq.url
      STEP_ARN          = "none" # Step Functions deferred — see Phase B note above
      TABLE_CONN        = var.connection_table_name
      WS_ENDPOINT       = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
    }
  }

  depends_on = [aws_iam_role_policy_attachment.ws_svc_basic_exec, aws_cloudwatch_log_group.ws_message]
  tags       = local.common_tags
}

# --- WebSocket API Gateway --------------------------------------------------

resource "aws_apigatewayv2_api" "ws" {
  name                       = "${local.name_prefix}-ws-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  tags                       = local.common_tags
}

resource "aws_apigatewayv2_integration" "connect" {
  api_id             = aws_apigatewayv2_api.ws.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.ws_connect.invoke_arn
}
resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connect.id}"
}
resource "aws_lambda_permission" "connect" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_connect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.ws.id}/*"
}

resource "aws_apigatewayv2_integration" "disconnect" {
  api_id           = aws_apigatewayv2_api.ws.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.ws_disconnect.invoke_arn
}
resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.disconnect.id}"
}
resource "aws_lambda_permission" "disconnect" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_disconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.ws.id}/*"
}

resource "aws_apigatewayv2_integration" "default" {
  api_id           = aws_apigatewayv2_api.ws.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.ws_message.invoke_arn
}
resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.default.id}"
}
resource "aws_lambda_permission" "default" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_message.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.ws.id}/*"
}

resource "aws_apigatewayv2_stage" "ws" {
  api_id      = aws_apigatewayv2_api.ws.id
  name        = var.environment
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }

  depends_on = [aws_apigatewayv2_route.connect, aws_apigatewayv2_route.disconnect, aws_apigatewayv2_route.default]
  tags       = local.common_tags
}