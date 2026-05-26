# Step 10 — CI/CD Pipeline (GitHub Actions)

## What This Creates

| File | Trigger | Purpose |
|---|---|---|
| `terraform-plan.yml` | Every Pull Request | fmt + validate + plan → PR comment |
| `terraform-apply.yml` | Merge to main | terraform apply automatically |

---

## Part 1 — GitHub Repository Setup

### 1. Create GitHub Repository

Go to https://github.com/new and create a new repository:
```
Name:    cb-ml-infra          (or your preferred name)
Private: ✅ Yes               (infrastructure code should be private)
```

### 2. Push Your Local Code

```bash
cd infra    # your project root

git init
git add .
git commit -m "initial infrastructure setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cb-ml-infra.git
git push -u origin main
```

---

## Part 2 — Configure GitHub Secrets

GitHub Secrets store your AWS credentials securely.
The pipeline reads them automatically — never hardcoded in yml files.

### Step-by-step:

**1. Go to your GitHub repository**

**2. Click Settings tab**

**3. Left sidebar → Secrets and variables → Actions**

**4. Click "New repository secret" and add each one:**

| Secret Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `TF_VAR_API_KEY` | Your generated API key (from Step 6) |

> ⚠️ Once saved, GitHub never shows the value again — store them safely.

---

## Part 3 — Branch Strategy

```
main          ← protected, production-ready code
               only updated via Pull Request

feature/*     ← your working branch
               e.g. feature/add-lambda, feature/update-waf
```

### Protect the main branch:

**1. Repository → Settings → Branches**

**2. Add branch protection rule:**
```
Branch name pattern:   main
☑ Require pull request before merging
☑ Require status checks to pass (select: Terraform Plan)
☑ Do not allow bypassing the above settings
```

This means **nobody can push directly to main** — everything goes through a PR with a passing Terraform plan.

---

## Part 4 — Daily Workflow

### Making infrastructure changes:

```bash
# 1. Create a feature branch
git checkout -b feature/add-new-lambda

# 2. Make your Terraform changes
# edit modules/observability/main.tf etc.

# 3. Format your code
terraform fmt -recursive

# 4. Push and open PR
git add .
git commit -m "add new lambda log group"
git push origin feature/add-new-lambda
```

**5. Open Pull Request on GitHub**
- Pipeline runs automatically
- Terraform plan posted as PR comment
- Review the plan — verify only expected changes

**6. Merge PR**
- `terraform apply` runs automatically
- Infrastructure updated in AWS

---

## Testing Checklist

### Verify Plan workflow runs on PR:

```bash
# 1. Create test branch
git checkout -b feature/test-pipeline

# 2. Make a small change (e.g. add a tag)
# edit any .tf file

# 3. Push and open PR
git add .
git commit -m "test pipeline"
git push origin feature/test-pipeline
```

Go to GitHub → repository → Actions tab
You should see **Terraform Plan** running ✅

Check the PR — plan output posted as comment ✅

### Verify Apply workflow runs on merge:

Merge the PR → go to Actions tab
You should see **Terraform Apply** running ✅

### Verify AWS changes applied:

```bash
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/cb-ml-dev" \
  --region ap-south-1
```

---

## Troubleshooting

**Plan fails with credentials error:**
```
Error: No valid credential sources found
```
→ Check GitHub Secrets are set correctly (Settings → Secrets → Actions)

**Init fails with backend error:**
```
Error: Failed to get existing workspaces
```
→ Confirm S3 state bucket name is correct in `environments/dev/main.tf`

**Format check fails:**
```
Files not formatted
```
→ Run `terraform fmt -recursive` locally before pushing
