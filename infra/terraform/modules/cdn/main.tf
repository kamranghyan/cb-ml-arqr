# =============================================================================
# CDN MODULE — CloudFront + WAF
# MVP: uses default CloudFront URL (no custom domain)
# Domain-ready: fill in domain_name + acm_cert_arn + route53_zone_id variables
# =============================================================================

locals {
  name_prefix = "${var.prefix}-${var.environment}"

  common_tags = {
    Project     = var.prefix
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
  }

  # Use custom domain if provided, otherwise use CloudFront default URL
  has_domain = var.domain_name != "" && var.acm_cert_arn != ""
}

# =============================================================================
# WAF — WebACL
# Note: WAF for CloudFront must be created in us-east-1 (global)
# =============================================================================

resource "aws_wafv2_web_acl" "main" {
  provider    = aws.us_east_1
  name        = "${local.name_prefix}-waf"
  description = "WAF for ${local.name_prefix} CloudFront distribution"
  scope       = "CLOUDFRONT" # must be CLOUDFRONT for use with CloudFront

  default_action {
    allow {} # allow by default; rules below block specific threats
  }

  # Rule 1 — AWS Managed: Core rule set (OWASP Top 10)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {} # use rule's default action (block)
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2 — AWS Managed: Known bad inputs (SQLi, XSS)
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3 — Rate limiting: max 1000 requests per 5 min per IP
  rule {
    name     = "RateLimitPerIP"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 1000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = local.common_tags
}

# =============================================================================
# CLOUDFRONT — Origin Access Control (OAC)
# Allows CloudFront to access S3 privately (no public S3 bucket needed)
# =============================================================================

resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "${local.name_prefix}-oac"
  description                       = "OAC for ${local.name_prefix} S3 origins"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# =============================================================================
# CLOUDFRONT — Distribution
# =============================================================================

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name_prefix} distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US + Europe only — cheapest for MVP
  web_acl_id          = aws_wafv2_web_acl.main.arn

  # Custom domain — only configured when domain_name + acm_cert_arn provided
  aliases = local.has_domain ? [var.domain_name] : []

  # -------------------------------------------------------------------------
  # Origin 1 — Menu Assets S3 bucket
  # -------------------------------------------------------------------------
  origin {
    domain_name              = var.menu_assets_bucket_regional_domain
    origin_id                = "menu-assets-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  # -------------------------------------------------------------------------
  # Origin 2 — AR Models S3 bucket
  # -------------------------------------------------------------------------
  origin {
    domain_name              = var.ar_models_bucket_regional_domain
    origin_id                = "ar-models-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  # -------------------------------------------------------------------------
  # Default cache behaviour — serves menu assets
  # -------------------------------------------------------------------------
  default_cache_behavior {
    target_origin_id       = "menu-assets-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # AWS Managed: CachingOptimized

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # -------------------------------------------------------------------------
  # Cache behaviour — AR models (longer TTL — models rarely change)
  # -------------------------------------------------------------------------
  ordered_cache_behavior {
    path_pattern           = "/ar-models/*"
    target_origin_id       = "ar-models-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
  }

  # -------------------------------------------------------------------------
  # SSL Certificate — default CloudFront cert for MVP, custom when domain added
  # -------------------------------------------------------------------------
  viewer_certificate {
    cloudfront_default_certificate = local.has_domain ? false : true
    acm_certificate_arn            = local.has_domain ? var.acm_cert_arn : null
    ssl_support_method             = local.has_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_domain ? "TLSv1.2_2021" : "TLSv1"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none" # no geo-blocking for MVP
    }
  }

  tags = local.common_tags
}

# =============================================================================
# CLOUDFRONT — Security Response Headers Policy
# Adds security headers to every response
# =============================================================================

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${local.name_prefix}-security-headers"
  comment = "Security headers for ${local.name_prefix}"

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }
  }
}

# =============================================================================
# S3 BUCKET POLICY — Allow CloudFront OAC to read from buckets
# =============================================================================

resource "aws_s3_bucket_policy" "menu_assets" {
  bucket = var.menu_assets_bucket_name
  policy = data.aws_iam_policy_document.menu_assets_cf.json
}

data "aws_iam_policy_document" "menu_assets_cf" {
  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${var.menu_assets_bucket_name}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "ar_models" {
  bucket = var.ar_models_bucket_name
  policy = data.aws_iam_policy_document.ar_models_cf.json
}

data "aws_iam_policy_document" "ar_models_cf" {
  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${var.ar_models_bucket_name}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

# =============================================================================
# ROUTE53 — Only created when domain is provided (future use)
# =============================================================================

resource "aws_route53_record" "main" {
  count   = local.has_domain && var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}
