# =============================================================================
# STEP 1 — BOOTSTRAP
# Creates the S3 bucket (remote state) and DynamoDB table (state lock).
# Run this ONCE manually using the management account credentials.
# After applying, never delete or modify these resources via Terraform.
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Bootstrap uses LOCAL state (no remote backend yet — chicken-and-egg)
  # After apply, state file lives at: bootstrap/terraform.tfstate
  # Commit this file to the repo or store it safely — it tracks these resources.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = "global"
      ManagedBy   = "terraform"
      Owner       = var.owner
      Purpose     = "terraform-bootstrap"
    }
  }
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name

  # Bucket name includes account ID to guarantee global uniqueness
  state_bucket_name = "${var.project_name}-terraform-state-${local.account_id}"
  logs_bucket_name  = "${var.project_name}-terraform-state-logs-${local.account_id}"
  lock_table_name   = "${var.project_name}-terraform-locks"
}

# =============================================================================
# S3 — ACCESS LOGS BUCKET (created first; state bucket logs into this)
# =============================================================================

resource "aws_s3_bucket" "state_logs" {
  bucket        = local.logs_bucket_name
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_ownership_controls" "state_logs" {
  bucket = aws_s3_bucket.state_logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "state_logs" {
  depends_on = [aws_s3_bucket_ownership_controls.state_logs]
  bucket     = aws_s3_bucket.state_logs.id
  acl        = "log-delivery-write"
}

resource "aws_s3_bucket_public_access_block" "state_logs" {
  bucket = aws_s3_bucket.state_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state_logs" {
  bucket = aws_s3_bucket.state_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state_logs" {
  bucket = aws_s3_bucket.state_logs.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 90
    }
  }
}

# =============================================================================
# S3 — STATE BUCKET (primary remote state store)
# =============================================================================

resource "aws_s3_bucket" "terraform_state" {
  bucket        = local.state_bucket_name
  force_destroy = false # Safety: prevent accidental destruction of all state

  lifecycle {
    prevent_destroy = true
  }
}

# Versioning — every state write creates a new version (rollback safety net)
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Encryption — state files contain sensitive resource attributes
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Block all public access — state files must never be publicly readable
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Access logging — who read or wrote state files and when
resource "aws_s3_bucket_logging" "terraform_state" {
  bucket        = aws_s3_bucket.terraform_state.id
  target_bucket = aws_s3_bucket.state_logs.id
  target_prefix = "state-bucket-access-logs/"
}

# Lifecycle — clean up old non-current state versions after 90 days
# Keeps last 30 versions; removes older ones to control storage cost
resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  depends_on = [aws_s3_bucket_versioning.terraform_state]
  bucket     = aws_s3_bucket.terraform_state.id

  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days           = 90
      newer_noncurrent_versions = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Bucket policy — deny non-TLS requests and deny delete on state files
resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  policy = data.aws_iam_policy_document.terraform_state_bucket.json
}

data "aws_iam_policy_document" "terraform_state_bucket" {
  # Deny any request not using TLS
  statement {
    sid    = "DenyNonTLS"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.terraform_state.arn,
      "${aws_s3_bucket.terraform_state.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  # Deny permanent delete of state objects (DeleteObject without version = soft delete only)
  statement {
    sid    = "DenyStateFileDeletion"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:DeleteObject"]

    resources = ["${aws_s3_bucket.terraform_state.arn}/*.tfstate"]
  }
}

# =============================================================================
# DYNAMODB — STATE LOCK TABLE
# =============================================================================

resource "aws_dynamodb_table" "terraform_locks" {
  name         = local.lock_table_name
  billing_mode = "PAY_PER_REQUEST" # No capacity planning needed; lock ops are infrequent
  hash_key     = "LockID"          # Terraform expects exactly this key name

  attribute {
    name = "LockID"
    type = "S"
  }

  # Protect against accidental table deletion — losing this means losing lock state
  lifecycle {
    prevent_destroy = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true # Uses AWS-managed key (SSE-DDB); sufficient for lock metadata
  }
}
