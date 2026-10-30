# =============================================================================
# DATA MODULE — DYNAMODB TABLES
# Schemas below are taken directly from each service's actual repository/
# service-layer code (boto3 Key=/KeyConditionExpression calls), not from
# template.yaml defaults — those only ever gave table names, never real keys.
# =============================================================================

resource "aws_dynamodb_table" "menu" {
  name         = "${var.prefix}-${var.environment}-menu"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "restaurantId"
  range_key    = "itemId"

  attribute {
    name = "restaurantId"
    type = "S"
  }
  attribute {
    name = "itemId"
    type = "S"
  }
  attribute {
    name = "categoryId"
    type = "S"
  }

  global_secondary_index {
    name            = "byCategory"
    hash_key        = "categoryId"
    range_key       = "itemId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "order" {
  name             = "${var.prefix}-${var.environment}-order"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  range_key        = "SK"
  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "restaurantId"
    type = "S"
  }
  attribute {
    name = "placedAt"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI-1-restaurant-orders"
    hash_key        = "restaurantId"
    range_key       = "placedAt"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "tenant" {
  name         = "${var.prefix}-${var.environment}-tenant"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenantId"

  attribute {
    name = "tenantId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "restaurant" {
  name         = "${var.prefix}-${var.environment}-restaurant"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "restaurantId"

  attribute {
    name = "restaurantId"
    type = "S"
  }
  attribute {
    name = "tenantId"
    type = "S"
  }

  global_secondary_index {
    name            = "tenantId-index"
    hash_key        = "tenantId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "category" {
  name         = "${var.prefix}-${var.environment}-category"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "categoryId"

  attribute {
    name = "categoryId"
    type = "S"
  }
  attribute {
    name = "restaurantId"
    type = "S"
  }

  global_secondary_index {
    name            = "restaurantId-index"
    hash_key        = "restaurantId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "item" {
  name         = "${var.prefix}-${var.environment}-item"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "itemId"

  attribute {
    name = "itemId"
    type = "S"
  }
  attribute {
    name = "restaurantId"
    type = "S"
  }
  attribute {
    name = "categoryId"
    type = "S"
  }

  global_secondary_index {
    name            = "restaurantId-index"
    hash_key        = "restaurantId"
    projection_type = "ALL"
  }
  global_secondary_index {
    name            = "categoryId-index"
    hash_key        = "categoryId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "addon" {
  name         = "${var.prefix}-${var.environment}-addon"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "addOnId"

  attribute {
    name = "addOnId"
    type = "S"
  }
  attribute {
    name = "menuItemId"
    type = "S"
  }

  global_secondary_index {
    name            = "menuItemId-index"
    hash_key        = "menuItemId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "dining" {
  name         = "${var.prefix}-${var.environment}-dining"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tableId"

  attribute {
    name = "tableId"
    type = "S"
  }
  attribute {
    name = "restaurantId"
    type = "S"
  }

  global_secondary_index {
    name            = "restaurantId-index"
    hash_key        = "restaurantId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "payment" {
  name         = "${var.prefix}-${var.environment}-payment"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "orderId"

  attribute {
    name = "orderId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "plan_types" {
  name         = "${var.prefix}-${var.environment}-plan-types"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "tenant_subscription" {
  name         = "${var.prefix}-${var.environment}-tenant-subscription"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "invoices" {
  name         = "${var.prefix}-${var.environment}-invoices"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "invoiceId"

  attribute {
    name = "invoiceId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "connection" {
  name         = "${var.prefix}-${var.environment}-connection"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }
  attribute {
    name = "guestSessionId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "restaurantId"
    type = "S"
  }

  global_secondary_index {
    name            = "guestSessionId-index"
    hash_key        = "guestSessionId"
    projection_type = "ALL"
  }
  global_secondary_index {
    name            = "restaurantId-index"
    hash_key        = "restaurantId"
    projection_type = "ALL"
  }
  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

resource "aws_dynamodb_table" "ws_order_subscriptions" {
  name         = "${var.prefix}-${var.environment}-ws-order-subscriptions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"
  range_key    = "orderId"

  attribute {
    name = "connectionId"
    type = "S"
  }
  attribute {
    name = "orderId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}