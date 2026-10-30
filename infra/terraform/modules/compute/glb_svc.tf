# =============================================================================
# GLB_SVC — S3-triggered .glb asset validator
# Not part of local.services on purpose: no API route, no shared layer, no
# pip dependencies at all (boto3/stdlib only, already in the Lambda runtime).
# Triggers on uploads/*.glb in the SAME bucket menu_svc/ar_svc use, moves
# validated files to approved/ or rejected/, and alerts admins via SNS on
# rejection.
# =============================================================================

resource "aws_sns_topic" "admin_alerts" {
  name = "${local.name_prefix}-admin-alerts"
  tags = local.common_tags
}

data "archive_file" "glb_svc" {
  type        = "zip"
  source_dir  = "${var.lambdas_src_path}/glb_svc"
  output_path = "${path.module}/build/glb_svc.zip"
  excludes    = ["tests", "samconfig.toml", "README.md", "notification.json", ".gitignore", "test_asset.glb", "real_test.glb"]
}

resource "aws_iam_role" "glb_svc" {
  name = "${local.name_prefix}-glb-svc-role"

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

resource "aws_iam_role_policy_attachment" "glb_svc_basic_exec" {
  role       = aws_iam_role.glb_svc.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "glb_svc" {
  name = "${local.name_prefix}-glb-svc-policy"
  role = aws_iam_role.glb_svc.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          "arn:aws:s3:::${var.menu_assets_bucket_name}",
          "arn:aws:s3:::${var.menu_assets_bucket_name}/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.admin_alerts.arn
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "glb_svc" {
  name              = "/aws/lambda/${local.name_prefix}-glb-svc"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_lambda_function" "glb_svc" {
  function_name = "${local.name_prefix}-glb-svc"
  role          = aws_iam_role.glb_svc.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.13"
  architectures = ["arm64"]
  memory_size   = 1024
  timeout       = 60

  filename         = data.archive_file.glb_svc.output_path
  source_code_hash = data.archive_file.glb_svc.output_base64sha256

  environment {
    variables = {
      BUCKET_AR = var.menu_assets_bucket_name
      SNS_ADMIN = aws_sns_topic.admin_alerts.arn
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.glb_svc_basic_exec,
    aws_cloudwatch_log_group.glb_svc,
  ]

  tags = local.common_tags
}

resource "aws_lambda_permission" "glb_svc_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.glb_svc.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = "arn:aws:s3:::${var.menu_assets_bucket_name}"
}

resource "aws_s3_bucket_notification" "menu_assets_glb_trigger" {
  bucket = var.menu_assets_bucket_name

  lambda_function {
    lambda_function_arn = aws_lambda_function.glb_svc.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ".glb"
  }

  depends_on = [aws_lambda_permission.glb_svc_s3]
}