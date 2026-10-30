# =============================================================================
# API GATEWAY — one REST API per REST-shaped service (menu, order, ar, pay,
# subs, auth, invoice — everything in local.services). Each is a pure
# passthrough: root method + {proxy+} method, both ANY, both AWS_PROXY. Each
# service's own FastAPI app does its own internal routing — API Gateway
# doesn't need to know or mirror the actual route shapes.
#
# Deliberately 7 separate APIs, not one shared one: pay_svc's root catch-all
# and auth_svc's root catch-all would collide on a single shared API.
# =============================================================================

resource "aws_api_gateway_rest_api" "this" {
  for_each    = local.services
  name        = "${local.name_prefix}-${replace(each.key, "_", "-")}-api"
  description = "Passthrough REST API for ${each.key}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

resource "aws_api_gateway_resource" "proxy" {
  for_each    = local.services
  rest_api_id = aws_api_gateway_rest_api.this[each.key].id
  parent_id   = aws_api_gateway_rest_api.this[each.key].root_resource_id
  path_part   = "{proxy+}"
}

# --- Root path ("/") ---------------------------------------------------

resource "aws_api_gateway_method" "root_any" {
  for_each      = local.services
  rest_api_id   = aws_api_gateway_rest_api.this[each.key].id
  resource_id   = aws_api_gateway_rest_api.this[each.key].root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "root_any" {
  for_each                = local.services
  rest_api_id             = aws_api_gateway_rest_api.this[each.key].id
  resource_id             = aws_api_gateway_rest_api.this[each.key].root_resource_id
  http_method             = aws_api_gateway_method.root_any[each.key].http_method
  integration_http_method = "POST"
  type                     = "AWS_PROXY"
  uri                      = aws_lambda_function.this[each.key].invoke_arn
}

resource "aws_api_gateway_method" "root_options" {
  for_each      = local.services
  rest_api_id   = aws_api_gateway_rest_api.this[each.key].id
  resource_id   = aws_api_gateway_rest_api.this[each.key].root_resource_id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "root_options" {
  for_each    = local.services
  rest_api_id = aws_api_gateway_rest_api.this[each.key].id
  resource_id = aws_api_gateway_rest_api.this[each.key].root_resource_id
  http_method = aws_api_gateway_method.root_options[each.key].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "root_options" {
  for_each    = local.services
  rest_api_id = aws_api_gateway_rest_api.this[each.key].id
  resource_id = aws_api_gateway_rest_api.this[each.key].root_resource_id
  http_method = aws_api_gateway_method.root_options[each.key].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "root_options" {
  for_each    = local.services
  rest_api_id = aws_api_gateway_rest_api.this[each.key].id
  resource_id = aws_api_gateway_rest_api.this[each.key].root_resource_id
  http_method = aws_api_gateway_method.root_options[each.key].http_method
  status_code = aws_api_gateway_method_response.root_options[each.key].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,PATCH,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# --- Proxy path ("/{proxy+}") -------------------------------------------

resource "aws_api_gateway_method" "proxy_any" {
  for_each      = local.services
  rest_api_id   = aws_api_gateway_rest_api.this[each.key].id
  resource_id   = aws_api_gateway_resource.proxy[each.key].id
  http_method   = "ANY"
  authorization = "NONE"
  request_parameters = { "method.request.path.proxy" = true }
}

resource "aws_api_gateway_integration" "proxy_any" {
  for_each                = local.services
  rest_api_id             = aws_api_gateway_rest_api.this[each.key].id
  resource_id             = aws_api_gateway_resource.proxy[each.key].id
  http_method             = aws_api_gateway_method.proxy_any[each.key].http_method
  integration_http_method = "POST"
  type                     = "AWS_PROXY"
  uri                      = aws_lambda_function.this[each.key].invoke_arn
}

resource "aws_api_gateway_method" "proxy_options" {
  for_each      = local.services
  rest_api_id   = aws_api_gateway_rest_api.this[each.key].id
  resource_id   = aws_api_gateway_resource.proxy[each.key].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "proxy_options" {
  for_each    = local.services
  rest_api_id = aws_api_gateway_rest_api.this[each.key].id
  resource_id = aws_api_gateway_resource.proxy[each.key].id
  http_method = aws_api_gateway_method.proxy_options[each.key].http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "proxy_options" {
  for_each    = local.services
  rest_api_id = aws_api_gateway_rest_api.this[each.key].id
  resource_id = aws_api_gateway_resource.proxy[each.key].id
  http_method = aws_api_gateway_method.proxy_options[each.key].http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "proxy_options" {
  for_each    = local.services
  rest_api_id = aws_api_gateway_rest_api.this[each.key].id
  resource_id = aws_api_gateway_resource.proxy[each.key].id
  http_method = aws_api_gateway_method.proxy_options[each.key].http_method
  status_code = aws_api_gateway_method_response.proxy_options[each.key].status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,PATCH,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# --- Permission, deployment, stage ---------------------------------------

resource "aws_lambda_permission" "apigw" {
  for_each      = local.services
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.this[each.key].execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "this" {
  for_each    = local.services
  rest_api_id = aws_api_gateway_rest_api.this[each.key].id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_method.root_any[each.key].id,
      aws_api_gateway_integration.root_any[each.key].id,
      aws_api_gateway_method.proxy_any[each.key].id,
      aws_api_gateway_integration.proxy_any[each.key].id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.root_any,
    aws_api_gateway_integration.proxy_any,
    aws_api_gateway_integration.root_options,
    aws_api_gateway_integration.proxy_options,
  ]
}

resource "aws_api_gateway_stage" "this" {
  for_each      = local.services
  deployment_id = aws_api_gateway_deployment.this[each.key].id
  rest_api_id   = aws_api_gateway_rest_api.this[each.key].id
  stage_name    = var.environment
  tags          = local.common_tags
}