# =============================================================================
# DEV ENVIRONMENT — REMOTE STATE BACKEND
# The S3 bucket and DynamoDB lock table referenced below are created once by
# infra/terraform/bootstrap/ (see bootstrap/outputs.tf). This file only tells
# THIS environment where its state lives — it does not create any resources.
# =============================================================================

terraform {
  backend "s3" {
    bucket       = "cb-ml-arqr-terraform-state-990016797093"
    key          = "dev/main/terraform.tfstate"
    region       = "ap-south-1"
    use_lockfile = true
    encrypt      = true
  }
}