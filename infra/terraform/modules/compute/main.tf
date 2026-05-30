# =============================================================================
# COMPUTE MODULE — Lambda Functions + API Gateway
# =============================================================================

locals {
  name_prefix = "${var.prefix}-${var.environment}"

  common_tags = {
    Project     = var.prefix
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
  }

  # Lambda functions with their source path and handler
  lambdas = {
    menu          = { source = "${var.lambdas_src_path}/menu",          handler = "index.handler" }
    order         = { source = "${var.lambdas_src_path}/order",         handler = "index.handler" }
    tenant        = { source = "${var.lambdas_src_path}/tenant",        handler = "index.handler" }
    auth          = { source = "${var.lambdas_src_path}/auth",          handler = "index.handler" }
    websocket     = { source = "${var.lambdas_src_path}/websocket",     handler = "index.handler" }
  }
}

# =============================================================================
# ZIP — Package each Lambda source folder
# =============================================================================

data "archive_file" "lambda" {
  for_each    = local.lambdas
  type        = "zip"
  source_dir  = each.value.source
  output_path = "${path.module}/zips/${each.key}.zip"
}

# =============================================================================
# IAM — Lambda Execution Role (shared across all Lambdas)
# =============================================================================

resource "aws_iam_role" "lambda_exec" {
  name = "${local.name_prefix}-lambda-exec-role"

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

# Basic execution policy — allows Lambda to write to CloudWatch logs
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# SSM read policy — allows Lambda to read SSM parameters
resource "aws_iam_role_policy" "lambda_ssm" {
  name = "${local.name_prefix}-lambda-ssm-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:GetParameters"]
      Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/${var.prefix}/${var.environment}/*"
    }]
  })
}

# =============================================================================
# LAMBDA FUNCTIONS
# =============================================================================

resource "aws_lambda_function" "this" {
  for_each = local.lambdas

  function_name    = "${local.name_prefix}-${each.key}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = each.value.handler
  runtime          = "python3.12"
  filename         = data.archive_file.lambda[each.key].output_path
  source_code_hash = data.archive_file.lambda[each.key].output_base64sha256

  timeout     = 30
  memory_size = 128

  environment {
    variables = {
      ENVIRONMENT = var.environment
      PREFIX      = var.prefix
    }
  }

  depends_on = [aws_iam_role_policy_attachment.lambda_basic]

  tags = local.common_tags
}

# CloudWatch Log Group per Lambda (pre-created in observability module)
# Lambda writes to /aws/lambda/{function_name} automatically

# =============================================================================
# API GATEWAY — REST API
# =============================================================================

resource "aws_api_gateway_rest_api" "main" {
  name        = "${local.name_prefix}-api"
  description = "REST API for ${local.name_prefix}"

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# /menu resource
# -----------------------------------------------------------------------------
resource "aws_api_gateway_resource" "menu" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "menu"
}

resource "aws_api_gateway_method" "menu" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.menu.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "menu" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.menu.id
  http_method             = aws_api_gateway_method.menu.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.this["menu"].invoke_arn
}

# -----------------------------------------------------------------------------
# /orders resource
# -----------------------------------------------------------------------------
resource "aws_api_gateway_resource" "orders" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "orders"
}

resource "aws_api_gateway_method" "orders" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.orders.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "orders" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.orders.id
  http_method             = aws_api_gateway_method.orders.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.this["order"].invoke_arn
}

# -----------------------------------------------------------------------------
# /tenants resource
# -----------------------------------------------------------------------------
resource "aws_api_gateway_resource" "tenants" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "tenants"
}

resource "aws_api_gateway_method" "tenants" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.tenants.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "tenants" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.tenants.id
  http_method             = aws_api_gateway_method.tenants.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.this["tenant"].invoke_arn
}

# -----------------------------------------------------------------------------
# /auth resource
# -----------------------------------------------------------------------------
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_method" "auth" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.auth.id
  http_method             = aws_api_gateway_method.auth.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.this["auth"].invoke_arn
}

# =============================================================================
# API GATEWAY — Deployment + Stage
# =============================================================================

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  # Redeploy when any integration changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_integration.menu,
      aws_api_gateway_integration.orders,
      aws_api_gateway_integration.tenants,
      aws_api_gateway_integration.auth,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_method.menu,
    aws_api_gateway_method.orders,
    aws_api_gateway_method.tenants,
    aws_api_gateway_method.auth,
  ]
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  tags = local.common_tags
}

# =============================================================================
# LAMBDA PERMISSIONS — Allow API Gateway to invoke each Lambda
# =============================================================================

resource "aws_lambda_permission" "menu" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this["menu"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "orders" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this["order"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "tenants" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this["tenant"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "auth" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this["auth"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}
