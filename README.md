# cb-ml-arqr
QR menu SaaS

Update the file


WITH S3

terraform apply -var="enable_direct_s3_hosting=true"

# Build each frontend as a static export, then sync it up
cd src/frontend/guest && npm run build && aws s3 sync out/ s3://cb-ml-dev-guest-ui/ --delete --region ap-south-1
# repeat for admin/ and kds/

terraform output guest_ui_website_endpoint
# → http://cb-ml-dev-guest-ui.s3-website.ap-south-1.amazonaws.com

WITH S3 For CLoudFront
terraform apply -var="enable_direct_s3_hosting=false"
# or simply: terraform apply   (default is already false)

terraform apply
