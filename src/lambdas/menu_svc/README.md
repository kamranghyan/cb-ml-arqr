# menu_svc — MenuLay Menu Microservice

FastAPI + Mangum Lambda (Python 3.13, arm64) for restaurants, categories,
items, tables, presigned URLs and direct uploads. Restructured from the
original `menu-fastapi` SAM project into the standard MenuLay service layout.

## Folder structure

```
menulay-backend/
├── layers/
│   └── shared_layer/                 # ← Lambda Layer (mounts at /opt/python)
│       └── python/
│           └── shared/               # cognito_auth, exceptions, structured_logger,
│                                     # aws_clients, response_builder, tenant_validator …
└── services/
    └── menu_svc/
        ├── handler.py                # thin Lambda entry → handler.lambda_handler
        ├── template.yaml             # SAM: SharedLayer + MenuFunction + API
        ├── samconfig.toml
        ├── requirements.txt
        ├── requirements-dev.txt
        ├── pytest.ini
        └── app/
            ├── main.py               # FastAPI app + Mangum (importable for uvicorn/pytest)
            ├── api/v1/
            │   ├── __init__.py       # api_router aggregation
            │   └── endpoints/
            │       ├── restaurants.py
            │       ├── categories.py
            │       ├── items.py
            │       ├── tables.py     # now uses TableService (legacy bridge removed)
            │       └── uploads.py    # presigned-url + direct multipart uploads
            ├── core/
            │   ├── config.py         # pydantic-settings — all env vars in one place
            │   ├── dependencies.py   # auth + tenant + service DI singletons
            │   └── exception_handlers.py
            ├── models/               # domain models (dataclass-based, DynamoDB shapes)
            ├── schemas/              # API envelopes (PaginatedResponse, PresignedUrlRequest)
            ├── services/             # business logic (+ new table_service.py)
            ├── repositories/         # s3_repository.py (multipart file parsing + S3 I/O)
            └── utils/                # logger, retry, dynamo_helpers, ids,
                                      # multipart.py, request_helpers.py
```

## Old → new mapping

| Old (menu-fastapi)                  | New                                            |
|-------------------------------------|------------------------------------------------|
| `main.py`                           | `app/main.py` + thin `handler.py`              |
| `app/routers/menu.py` (595 lines)   | `app/api/v1/endpoints/*.py` (5 files)          |
| `app/dependencies.py` + `menu_deps` | `app/core/dependencies.py`                     |
| exception handlers in `main.py`     | `app/core/exception_handlers.py`               |
| `menu/models/*` (minus schemas)     | `app/models/*`                                 |
| `menu/models/schemas.py`            | `app/schemas/common.py`                        |
| `menu/services/*`                   | `app/services/*`                               |
| `menu/handlers/table_handler.py`    | `app/services/table_service.py` (proper service, raises `shared.exceptions`) |
| `menu/handlers/request.py`          | `app/utils/multipart.py` + `app/utils/request_helpers.py` |
| `menu/repository/s3.py`             | `app/repositories/s3_repository.py`            |
| `shared/` (bundled in package)      | `layers/shared_layer/python/shared/` (Lambda Layer) |
| `menu/handlers/{router,restaurant_handler,category_handler,item_handler,presigned_handler,upload_handler,test_handler}.py` | **removed** — legacy pre-FastAPI path, no longer referenced |

## Key changes

- **Shared code is now a Lambda Layer.** `template.yaml` defines `SharedLayer`
  (`ContentUri: ../../layers/shared_layer`) and attaches it to the function.
  In Lambda it mounts at `/opt/python`, so `import shared` keeps working
  unchanged. For local dev/pytest, `handler.py` and `pytest.ini` add
  `layers/shared_layer/python` to the path.
- **Handler is `handler.lambda_handler`** (was `main.handler`). It binds a
  correlation id and delegates to the Mangum handler from `app/main.py`.
- **Tables are a first-class service.** The old FastAPI→fake-event→legacy
  handler→unwrap-Lambda-response bridge is gone; `TableService` returns data
  and raises `shared.exceptions`, handled by the global exception handlers.
- **All env vars documented in `app/core/config.py`** (pydantic-settings).

## Run locally

```bash
cd services/menu_svc
pip install -r requirements.txt -r requirements-dev.txt
export PYTHONPATH=".:../../layers/shared_layer/python"
uvicorn app.main:app --reload --port 8000
# Swagger: http://localhost:8000/docs
```

## Deploy

```bash
cd services/menu_svc
sam build
sam deploy --config-file samconfig.toml
```

`sam build` packages the layer from `../../layers/shared_layer` automatically
via the `SharedLayer` resource.
