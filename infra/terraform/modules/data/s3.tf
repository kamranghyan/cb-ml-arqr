# =============================================================================
# DATA MODULE — S3 BUCKETS
# =============================================================================

locals {
  buckets = {
    # Asset buckets
    menu_assets       = "${var.prefix}-${var.environment}-menu-assets"
    ar_models         = "${var.prefix}-${var.environment}-ar-models"
    analytics_archive = "${var.prefix}-${var.environment}-analytics-archive"
    logs              = "${var.prefix}-${var.environment}-logs"

    # UI buckets — one per interface
    guest_ui          = "${var.prefix}-${var.environment}-guest-ui"
    kds_ui            = "${var.prefix}-${var.environment}-kds-ui"
    admin_ui          = "${var.prefix}-${var.environment}-admin-ui"
  }

  versioned_buckets = ["menu_assets", "ar_models"]
}

resource "aws_s3_bucket" "this" {
  for_each      = local.buckets
  bucket        = each.value
  force_destroy = var.environment == "prod" ? false : true

  tags = merge(local.common_tags, { BucketType = each.key })
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = local.buckets
  bucket   = aws_s3_bucket.this[each.key].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = local.buckets
  bucket   = aws_s3_bucket.this[each.key].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = toset(local.versioned_buckets)
  bucket   = aws_s3_bucket.this[each.key].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.this["logs"].id

  rule {
    id     = "expire-logs"
    status = "Enabled"
    filter {}
    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "analytics" {
  bucket = aws_s3_bucket.this["analytics_archive"].id

  rule {
    id     = "archive-to-glacier"
    status = "Enabled"
    filter {}
    transition {
      days          = 30
      storage_class = "GLACIER"
    }
  }
}
