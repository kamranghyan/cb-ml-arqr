# =============================================================================
# DATA MODULE — S3 BUCKETS
# =============================================================================

locals {
  buckets = {
    menu_assets       = "${var.prefix}-${var.environment}-ml-menu-assets"
    ar_models         = "${var.prefix}-${var.environment}-ml-ar-models"
    analytics_archive = "${var.prefix}-${var.environment}-ml-analytics-archive"
    logs              = "${var.prefix}-${var.environment}-ml-logs"
    invoices          = "${var.prefix}-${var.environment}-invoices"

    guest_ui = "${var.prefix}-${var.environment}-ml-guest-ui"
    kds_ui   = "${var.prefix}-${var.environment}-ml-kds-ui"
    admin_ui = "${var.prefix}-${var.environment}-ml-admin-ui"
  }

  versioned_buckets = ["menu_assets", "ar_models"]

  # UI buckets are the only ones that ever go public, and only while
  # enable_direct_s3_hosting = true — a stopgap for testing before CloudFront
  # is available on this account (see infra-README for the AWS Support ticket
  # status). Everything else stays locked down regardless of this flag.
  ui_buckets = ["guest_ui", "kds_ui", "admin_ui"]
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

  block_public_acls  = true
  ignore_public_acls = true
  block_public_policy     = contains(local.ui_buckets, each.key) && var.enable_direct_s3_hosting ? false : true
  restrict_public_buckets = contains(local.ui_buckets, each.key) && var.enable_direct_s3_hosting ? false : true
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

# =============================================================================
# TEMPORARY DIRECT S3 HOSTING — testing only, while CloudFront is blocked.
# Off by default. Flip enable_direct_s3_hosting back to false (and re-apply)
# once the CloudFront account verification clears.
# =============================================================================

resource "aws_s3_bucket_website_configuration" "ui" {
  for_each = var.enable_direct_s3_hosting ? toset(local.ui_buckets) : toset([])
  bucket   = aws_s3_bucket.this[each.key].id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "404.html"
  }
}

resource "aws_s3_bucket_policy" "ui_public_read" {
  for_each   = var.enable_direct_s3_hosting ? toset(local.ui_buckets) : toset([])
  bucket     = aws_s3_bucket.this[each.key].id
  depends_on = [aws_s3_bucket_public_access_block.this]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadForTesting"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.this[each.key].arn}/*"
    }]
  })
}