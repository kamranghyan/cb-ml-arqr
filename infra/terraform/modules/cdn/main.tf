# =============================================================================
# CDN MODULE — CloudFront + WAF
# Single distribution with path-based routing to 3 UI buckets
# /guest/* → guest-ui S3
# /kds/*   → kds-ui S3
# /admin/* → admin-ui S3
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

  has_domain = var.domain_name != "" && var.acm_cert_arn != ""
}

data "aws_caller_identity" "current" {}

# =============================================================================
# WAF
# =============================================================================

resource "aws_wafv2_web_acl" "main" {
  provider    = aws.us_east_1
  name        = "${local.name_prefix}-waf"
  description = "WAF for ${local.name_prefix}"
  scope       = "CLOUDFRONT"

  default_action { 
    allow {} 
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action { 
      none {} 
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
# OAC — shared across all S3 origins
# =============================================================================

resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "${local.name_prefix}-oac"
  description                       = "OAC for ${local.name_prefix}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# =============================================================================
# Security Headers Policy
# =============================================================================

resource "aws_cloudfront_response_headers_policy" "security" {
  name = "${local.name_prefix}-security-headers"

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
# CLOUDFRONT DISTRIBUTION
# =============================================================================

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name_prefix}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  web_acl_id          = aws_wafv2_web_acl.main.arn
  aliases             = local.has_domain ? [var.domain_name] : []

  # --- Origins ---------------------------------------------------------------

  # Asset origins
  origin {
    domain_name              = var.menu_assets_bucket_regional_domain
    origin_id                = "menu-assets-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
    s3_origin_config { origin_access_identity = "" }
  }

  origin {
    domain_name              = var.ar_models_bucket_regional_domain
    origin_id                = "ar-models-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
    s3_origin_config { origin_access_identity = "" }
  }

  # UI origins
  origin {
    domain_name              = var.guest_ui_bucket_regional_domain
    origin_id                = "guest-ui-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
    s3_origin_config { origin_access_identity = "" }
  }

  origin {
    domain_name              = var.kds_ui_bucket_regional_domain
    origin_id                = "kds-ui-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
    s3_origin_config { origin_access_identity = "" }
  }

  origin {
    domain_name              = var.admin_ui_bucket_regional_domain
    origin_id                = "admin-ui-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
    s3_origin_config { origin_access_identity = "" }
  }

  # --- Default behaviour (menu assets) ---------------------------------------
  default_cache_behavior {
    target_origin_id       = "menu-assets-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # --- Path behaviours -------------------------------------------------------

  # AR models
  ordered_cache_behavior {
    path_pattern           = "/ar-models/*"
    target_origin_id       = "ar-models-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # Guest UI — /guest/*
  ordered_cache_behavior {
    path_pattern           = "/guest/*"
    target_origin_id       = "guest-ui-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # KDS UI — /kds/*
  ordered_cache_behavior {
    path_pattern           = "/kds/*"
    target_origin_id       = "kds-ui-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # Admin UI — /admin/*
  ordered_cache_behavior {
    path_pattern           = "/admin/*"
    target_origin_id       = "admin-ui-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  viewer_certificate {
    cloudfront_default_certificate = local.has_domain ? false : true
    acm_certificate_arn            = local.has_domain ? var.acm_cert_arn : null
    ssl_support_method             = local.has_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_domain ? "TLSv1.2_2021" : "TLSv1"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = local.common_tags
}

# =============================================================================
# S3 BUCKET POLICIES — Allow CloudFront OAC only
# =============================================================================

locals {
  cf_arn = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.main.id}"

  ui_buckets = {
    menu_assets = var.menu_assets_bucket_name
    ar_models   = var.ar_models_bucket_name
    guest_ui    = var.guest_ui_bucket_name
    kds_ui      = var.kds_ui_bucket_name
    admin_ui    = var.admin_ui_bucket_name
  }
}

resource "aws_s3_bucket_policy" "this" {
  for_each = local.ui_buckets
  bucket   = each.value

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontOAC"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "arn:aws:s3:::${each.value}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = local.cf_arn
        }
      }
    }]
  })
}

# =============================================================================
# ROUTE53 — only when domain provided
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
