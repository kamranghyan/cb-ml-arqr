# =============================================================================
# COMPUTE MODULE — Real MenuLay Lambda Functions + Shared Layer
# =============================================================================
# Scope of this step: the 7 services that are single-function REST APIs.
# Deliberately NOT included here (see module README for why):
#   - ws_svc            → needs an API Gateway WebSocket API, not REST (own step)
#   - notif_svc         → Step Functions / async worker, no API event at all
#   - glb_svc           → S3-triggered 3D asset processor, no API event at all
#   - subs_svc's second
#     function (PaymentSucceededEventHandler) → EventBridge-triggered, needs
#     the eventbridge/messaging modules that don't exist yet
#
# API Gateway wiring is ALSO not in this module on purpose — that's the next
# step (a dedicated `api` module), so this module can be deployed and each
# Lambda smoke-tested with `aws lambda invoke` before routing is layered on.
# =============================================================================

terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.prefix}-${var.environment}"

  common_tags = {
    Project     = var.prefix
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
  }

  services = {

    menu_svc = {
      dir              = "menu_svc"
      handler          = "handler.lambda_handler"
      runtime          = "python3.12"
      architecture     = "arm64"
      memory_size      = 512
      timeout          = 30
      use_shared_layer = true
      dynamodb_tables  = ["restaurant", "category", "item", "addon", "dining", "order", "tenant"]
      s3_buckets       = [var.menu_assets_bucket_name]
      env = {
        ENVIRONMENT          = var.environment
        LOG_LEVEL            = "INFO"
        RESTAURANT_TABLE     = "${local.name_prefix}-restaurant"
        CATEGORY_TABLE       = "${local.name_prefix}-category"
        ITEM_TABLE           = "${local.name_prefix}-item"
        ADDON_TABLE          = "${local.name_prefix}-addon"
        DINING_TABLE         = "${local.name_prefix}-dining"
        ORDER_TABLE          = "${local.name_prefix}-order"
        TENANT_TABLE         = "${local.name_prefix}-tenant"
        S3_BUCKET            = var.menu_assets_bucket_name
        ASSET_BUCKET_NAME    = var.menu_assets_bucket_name
        REDIS_HOST           = "localhost"
        REDIS_PORT           = "6379"
        MAX_IMAGE_MB         = "5"
        MAX_AR_MB            = "50"
        COGNITO_REGION       = var.aws_region
        COGNITO_USER_POOL_ID = var.cognito_user_pool_id
        COGNITO_CLIENT_ID    = var.cognito_admin_client_id
      }
    }

    order_svc = {
      dir              = "order_svc"
      handler          = "handler.lambda_handler"
      runtime          = "python3.12"
      architecture     = "arm64"
      memory_size      = 512
      timeout          = 30
      use_shared_layer = true
      dynamodb_tables  = ["menu", "item", "order", "dining"]
      s3_buckets       = []
      env = {
        ENVIRONMENT             = var.environment
        LOG_LEVEL               = "INFO"
        TABLE_MENU              = "${local.name_prefix}-menu"
        ITEM_TABLE              = "${local.name_prefix}-item"
        TABLE_ORDER             = "${local.name_prefix}-order"
        DINING_TABLE            = "${local.name_prefix}-dining"
        STEP_ARN                = aws_sfn_state_machine.order_workflow.arn
        NOTIFICATIONS_QUEUE_URL = "none"
        SKIP_MENU               = "false"
        REDIS_HOST              = "localhost"
        REDIS_PORT              = "6379"
        COGNITO_REGION          = var.aws_region
        COGNITO_USER_POOL_ID    = var.cognito_user_pool_id
        COGNITO_CLIENT_ID       = var.cognito_admin_client_id
      }
    }

    ar_svc = {
      dir              = "ar_svc"
      handler          = "handler.lambda_handler"
      runtime          = "python3.13"
      architecture     = "arm64"
      memory_size      = 512
      timeout          = 30
      use_shared_layer = true
      dynamodb_tables  = ["item"]
      s3_buckets       = [var.ar_models_bucket_name]
      env = {
        ENVIRONMENT          = var.environment
        LOG_LEVEL            = "INFO"
        ITEM_TABLE           = "${local.name_prefix}-item"
        ASSET_BUCKET_NAME    = var.ar_models_bucket_name
        CF_DOMAIN            = "${var.menu_assets_bucket_name}.s3.${var.aws_region}.amazonaws.com" # was var.cloudfront_domain — swap to the real CloudFront domain once available
        COGNITO_REGION       = var.aws_region
        COGNITO_USER_POOL_ID = var.cognito_user_pool_id
        COGNITO_CLIENT_ID    = var.cognito_admin_client_id
      }
    }

    pay_svc = {
      dir              = "pay_svc"
      handler          = "app.main.handler"
      runtime          = "python3.12"
      architecture     = "arm64"
      memory_size      = 256
      timeout          = 30
      use_shared_layer = true
      dynamodb_tables  = ["payment"]
      s3_buckets       = []
      env = {
        ENVIRONMENT             = var.environment
        PAYMENTS_TABLE_NAME     = "${local.name_prefix}-payment"
        EVENT_BUS_NAME          = "${local.name_prefix}-events"
        EASYPAISA_ENV           = "sandbox"
        EASYPAISA_STORE_ID      = "12345"
        EASYPAISA_CREDENTIALS   = "dummy_key"
        EASYPAISA_ACCOUNT_NUM   = "03001234567"
        EASYPAISA_BASE_URL      = "https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4"
        EASYPAISA_POST_BACK_URL = "https://example.com/callback"
        USE_MOCK_PAYMENTS       = "true"
      }
    }

    subs_svc = {
      dir              = "subs_svc"
      handler          = "handler.handler"
      runtime          = "python3.12"
      architecture     = "arm64"
      memory_size      = 256
      timeout          = 60
      use_shared_layer = true
      dynamodb_tables  = ["tenant", "plan-types", "tenant-subscription", "restaurant"]
      s3_buckets       = []
      env = {
        ENVIRONMENT          = var.environment
        LOG_LEVEL            = "INFO"
        TENANT_TABLE         = "${local.name_prefix}-tenant"
        PLAN_TABLE           = "${local.name_prefix}-plan-types"
        SUBSCRIPTION_TABLE   = "${local.name_prefix}-tenant-subscription"
        RESTAURANT_TABLE     = "${local.name_prefix}-restaurant"
        COGNITO_REGION       = var.aws_region
        COGNITO_USER_POOL_ID = var.cognito_user_pool_id
        COGNITO_CLIENT_ID    = var.cognito_admin_client_id
        EVENT_BUS_NAME       = "${local.name_prefix}-events"
      }
    }

    auth_svc = {
      dir              = "auth_svc"
      handler          = "handler.lambda_handler"
      runtime          = "python3.13"
      architecture     = "arm64"
      memory_size      = 512
      timeout          = 30
      use_shared_layer = true
      dynamodb_tables  = []
      s3_buckets       = []
      env = {
        ENVIRONMENT = var.environment
        LOG_LEVEL   = "INFO"
      }
    }

    invoice_svc = {
      dir              = "invoice_svc"
      handler          = "app.main.handler"
      runtime          = "python3.12"
      architecture     = "arm64"
      memory_size      = 512
      timeout          = 30
      use_shared_layer = false
      dynamodb_tables  = ["invoices"]
      s3_buckets       = ["${local.name_prefix}-invoices"]
      env = {
        ENVIRONMENT          = var.environment
        INVOICES_TABLE_NAME  = "${local.name_prefix}-invoices"
        INVOICES_BUCKET_NAME = "${local.name_prefix}-invoices"
      }
    }
  }
}

# =============================================================================
# SHARED LAMBDA LAYER
# =============================================================================

resource "null_resource" "shared_layer_build" {
  triggers = {
    requirements_hash = filemd5("${var.lambdas_src_path}/layers/shared_layer/requirements.txt")
    source_hash = sha1(join(",", [
      for f in sort(fileset("${var.lambdas_src_path}/layers/shared_layer/python", "**/*.py")) :
      filemd5("${var.lambdas_src_path}/layers/shared_layer/python/${f}")
    ]))
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      rm -rf "${path.module}/build/shared_layer"
      mkdir -p "${path.module}/build/shared_layer/python"
      cp -r "${var.lambdas_src_path}/layers/shared_layer/python/." "${path.module}/build/shared_layer/python/"
      find "${path.module}/build/shared_layer/python" -name "__pycache__" -type d -exec rm -rf {} + || true
      python3 -m pip install \
        -r "${var.lambdas_src_path}/layers/shared_layer/requirements.txt" \
        -t "${path.module}/build/shared_layer/python" \
        --platform manylinux2014_aarch64 \
        --python-version 3.12 \
        --implementation cp \
        --only-binary=:all: \
        --upgrade
    EOT
  }
}

data "archive_file" "shared_layer" {
  type        = "zip"
  source_dir  = "${path.module}/build/shared_layer"
  output_path = "${path.module}/build/shared_layer.zip"
  depends_on  = [null_resource.shared_layer_build]
}

resource "aws_lambda_layer_version" "shared" {
  layer_name               = "${local.name_prefix}-shared"
  description              = "MenuLay shared layer — cognito auth, exceptions, structured logging"
  filename                 = data.archive_file.shared_layer.output_path
  source_code_hash         = data.archive_file.shared_layer.output_base64sha256
  compatible_runtimes      = ["python3.12", "python3.13"]
  compatible_architectures = ["arm64"]
}

# =============================================================================
# PER-SERVICE BUILD
# =============================================================================

resource "null_resource" "build" {
  for_each = local.services

  triggers = {
    requirements_hash = filemd5("${var.lambdas_src_path}/${each.value.dir}/requirements.txt")
    source_hash = sha1(join(",", [
      for f in sort(fileset("${var.lambdas_src_path}/${each.value.dir}", "**/*.py")) :
      filemd5("${var.lambdas_src_path}/${each.value.dir}/${f}")
    ]))
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      rm -rf "${path.module}/build/${each.key}"
      mkdir -p "${path.module}/build/${each.key}"
      cp -r "${var.lambdas_src_path}/${each.value.dir}/." "${path.module}/build/${each.key}/"
      rm -rf "${path.module}/build/${each.key}/tests"
      find "${path.module}/build/${each.key}" -name "__pycache__" -type d -exec rm -rf {} + || true
      python3 -m pip install \
        -r "${var.lambdas_src_path}/${each.value.dir}/requirements.txt" \
        -t "${path.module}/build/${each.key}" \
        --platform manylinux2014_${each.value.architecture == "arm64" ? "aarch64" : "x86_64"} \
        --python-version ${replace(each.value.runtime, "python", "")} \
        --implementation cp \
        --only-binary=:all: \
        --upgrade
    EOT
  }
}

data "archive_file" "function" {
  for_each = local.services

  type        = "zip"
  source_dir  = "${path.module}/build/${each.key}"
  output_path = "${path.module}/build/${each.key}.zip"
  depends_on  = [null_resource.build]
}

# =============================================================================
# IAM — one role per service
# =============================================================================

resource "aws_iam_role" "lambda" {
  for_each = local.services
  name     = "${local.name_prefix}-${replace(each.key, "_", "-")}-role"

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

resource "aws_iam_role_policy_attachment" "basic_exec" {
  for_each   = local.services
  role       = aws_iam_role.lambda[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "dynamodb" {
  for_each = { for k, v in local.services : k => v if length(v.dynamodb_tables) > 0 }
  name     = "${local.name_prefix}-${replace(each.key, "_", "-")}-dynamodb"
  role     = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem",
        "dynamodb:Query", "dynamodb:Scan", "dynamodb:BatchGetItem", "dynamodb:BatchWriteItem"
      ]
      Resource = flatten([
        for t in each.value.dynamodb_tables : [
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${local.name_prefix}-${t}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${local.name_prefix}-${t}/index/*"
        ]
      ])
    }]
  })
}

resource "aws_iam_role_policy" "s3" {
  for_each = { for k, v in local.services : k => v if length(v.s3_buckets) > 0 }
  name     = "${local.name_prefix}-${replace(each.key, "_", "-")}-s3"
  role     = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
      Resource = flatten([for b in each.value.s3_buckets : ["arn:aws:s3:::${b}/*"]])
    }]
  })
}

resource "aws_iam_role_policy" "ssm" {
  for_each = local.services
  name     = "${local.name_prefix}-${replace(each.key, "_", "-")}-ssm"
  role     = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:GetParameters"]
      Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.prefix}/${var.environment}/*"
    }]
  })
}

resource "aws_iam_role_policy" "cognito" {
  for_each = { for k, v in local.services : k => v if contains(keys(v.env), "COGNITO_USER_POOL_ID") }
  name     = "${local.name_prefix}-${replace(each.key, "_", "-")}-cognito"
  role     = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminGetUser", "cognito-idp:GetUser", "cognito-idp:ListUsers"]
      Resource = var.cognito_user_pool_arn
    }]
  })
}

# =============================================================================
# LAMBDA FUNCTIONS + LOG GROUPS
# =============================================================================

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = local.services
  name              = "/aws/lambda/${local.name_prefix}-${replace(each.key, "_", "-")}"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_lambda_function" "this" {
  for_each = local.services

  function_name = "${local.name_prefix}-${replace(each.key, "_", "-")}"
  role          = aws_iam_role.lambda[each.key].arn
  handler       = each.value.handler
  runtime       = each.value.runtime
  architectures = [each.value.architecture]

  filename         = data.archive_file.function[each.key].output_path
  source_code_hash = data.archive_file.function[each.key].output_base64sha256

  memory_size = each.value.memory_size
  timeout     = each.value.timeout
  layers      = each.value.use_shared_layer ? [aws_lambda_layer_version.shared.arn] : []

  environment {
    variables = each.value.env
  }

  depends_on = [
    aws_iam_role_policy_attachment.basic_exec,
    aws_cloudwatch_log_group.lambda,
  ]

  tags = local.common_tags
}