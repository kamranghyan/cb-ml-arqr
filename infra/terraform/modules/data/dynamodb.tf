# =============================================================================
# DATA MODULE — DYNAMODB TABLES
# =============================================================================

# -----------------------------------------------------------------------------
# MenuTable
# GSI: byRestaurantId (query all menu items per restaurant)
# -----------------------------------------------------------------------------
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

  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# OrderTable
# GSI: byRestaurantId (query all orders per restaurant)
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "order" {
  name         = "${var.prefix}-${var.environment}-order"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "orderId"
  range_key    = "createdAt"

  attribute {
    name = "orderId"
    type = "S"
  }
  attribute {
    name = "createdAt"
    type = "S"
  }
  attribute {
    name = "restaurantId"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "byRestaurantId"
    hash_key        = "restaurantId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "byStatus"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# TenantTable
# GSI: byTenantId (lookup tenant config)
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "tenant" {
  name         = "${var.prefix}-${var.environment}-tenant"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenantId"

  attribute {
    name = "tenantId"
    type = "S"
  }
  attribute {
    name = "slug"
    type = "S"
  }

  global_secondary_index {
    name            = "bySlug"
    hash_key        = "slug"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# ConnectionTable  (WebSocket connectionIds per tenant)
# GSI: byTenantId (broadcast to all connections of a tenant)
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "connection" {
  name         = "${var.prefix}-${var.environment}-connection"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }
  attribute {
    name = "tenantId"
    type = "S"
  }

  global_secondary_index {
    name            = "byTenantId"
    hash_key        = "tenantId"
    projection_type = "ALL"
  }

  # Auto-expire stale WebSocket connections after 24h
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = var.environment == "prod" ? true : false

  tags = local.common_tags
}
