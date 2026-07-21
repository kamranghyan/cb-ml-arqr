# ar_svc — MenuLay AR Assets Microservice

FastAPI + Mangum Lambda (Python 3.13, arm64) for AR model metadata on menu
items: presigned S3 URLs for `.glb` models, metadata update/delete, and
CloudFront cache invalidation. Restructured from the original
`ar-assets-fastapi` SAM project into the standard MenuLay service layout,
reusing the shared Lambda Layer.

## Folder structure

```
ar_svc/
├── handler.py                # thin Lambda entry → handler.lambda_handler
├── template.yaml             # SAM: SharedLayer + ArAssetsFunction + API
├── samconfig.toml
├── requirements.txt
├── requirements-dev.txt
├── pytest.ini
├── tests/
└── app/
    ├── main.py               # FastAPI app + Mangum
    ├── api/v1/
    │   ├── __init__.py       # api_router (mounts ar_assets at /ar)
    │   └── endpoints/
    │       └── ar_assets.py  # GET (public) / PUT / DELETE
    ├── core/
    │   ├── config.py         # pydantic-settings — all env vars
    │   ├── dependencies.py   # auth + tenant + ArAssetsService DI
    │   └── exception_handlers.py
    ├── schemas/
    │   └── ar_asset.py       # ArUpdateBody (wire model)
    ├── services/
    │   └── ar_assets_service.py   # S3 presign + DynamoDB + CloudFront
    ├── models/               # (empty — AR metadata lives on the menu item)
    └── utils/
```

> The shared layer lives at `../../layers/shared_layer` (same one used by
> `menu_svc` and `order_svc`). This zip contains only `ar_svc`; drop it into
> `menulay-backend/services/` alongside the others.

## Old → new mapping

| Old (ar-assets-fastapi)          | New                                        |
|----------------------------------|--------------------------------------------|
| `main.py`                        | `app/main.py` + thin `handler.py`          |
| `app/routers/ar_assets.py`       | `app/api/v1/endpoints/ar_assets.py`        |
| `ArUpdateBody` (inline in router)| `app/schemas/ar_asset.py`                  |
| `app/dependencies.py`            | `app/core/dependencies.py`                 |
| exception handlers in `main.py`  | `app/core/exception_handlers.py`           |
| `ar_assets/service.py`           | `app/services/ar_assets_service.py`        |
| `shared/` (bundled in package)   | `layers/shared_layer/python/shared/` (Layer) |

## Key changes

- **Shared code is the same Lambda Layer** used by the other services
  (`ContentUri: ../../layers/shared_layer`), mounted at `/opt/python` in
  Lambda, so `import shared` is unchanged. Locally, `handler.py` and
  `pytest.ini` add the layer path.
- **Handler is `handler.lambda_handler`** (was `main.handler`).
- **Env vars centralised** in `app/core/config.py` (pydantic-settings).
  Both `TABLE_MENU` and `MENU_TABLE` are still exported by the template for
  backward compatibility; the service reads `TABLE_MENU`.
- **IAM policy unchanged** — DynamoDB (`GetItem`/`UpdateItem` on the menu
  table), S3 `GetObject` on the asset bucket, and CloudFront
  `CreateInvalidation` + `ListDistributions`.

## Routes

```
GET    /ar/{restaurantId}/{itemId}   presigned AR model URL   public (X-Tenant-Id)
PUT    /ar/{restaurantId}/{itemId}   update AR metadata       admin / tenant
DELETE /ar/{restaurantId}/{itemId}   remove AR metadata       admin / tenant
GET    /health                       liveness                 public
```

## Run locally

```bash
cd services/ar_svc
pip install -r requirements.txt -r requirements-dev.txt
export PYTHONPATH=".:../../layers/shared_layer/python"
export TABLE_MENU=MenuTable-dev ASSET_BUCKET_NAME=menu-assets-dev CF_DOMAIN=d2rw2kah485lhg.cloudfront.net
uvicorn app.main:app --reload --port 8002
# Swagger: http://localhost:8002/docs
```

## Deploy

```bash
cd services/ar_svc
sam build
sam deploy --config-file samconfig.toml
```
