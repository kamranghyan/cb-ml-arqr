# =============================================================================
# DEV ENVIRONMENT — BACKEND CONFIG
# Generated from bootstrap outputs. Fill in bucket name from bootstrap output.
# This file tells Terraform where to store state for the DEV environment.
#
# HOW TO USE:
#   1. Run bootstrap first (see /bootstrap/README.md)
#   2. Copy the state_bucket_name output value into 'bucket' below
#   3. Run: terraform init
# =============================================================================

terraform {
  backend "s3" {
    bucket         = "cb-ml-state-bucket"
    region         = "ap-south-1"
    use_lockfile   = true
    encrypt        = true

    # Each module in each env gets its own isolated state file
    # Pattern: {env}/{module}/terraform.tfstate
    key = "dev/network/terraform.tfstate"
  }
}
