# =============================================================================
# OBSERVABILITY MODULE — CloudWatch Log Groups
# One log group per Lambda function
# =============================================================================
terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [ aws.us_east_1 ] # <-- Keep this ONLY in the modules directory!
    }
  }
}

locals {
  name_prefix = "${var.prefix}-${var.environment}"

  common_tags = {
    Project     = var.prefix
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
  }

  # All Lambda function names — add more here as new Lambdas are created
  lambda_functions = [
    "menu",
    "order",
    "tenant",
    "auth",
    "websocket",
    "test-pipeline",
  ]
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = toset(local.lambda_functions)

  name              = "/aws/lambda/${local.name_prefix}-${each.key}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}
