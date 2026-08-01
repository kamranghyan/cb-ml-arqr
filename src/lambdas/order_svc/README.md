# order_svc — MenuLay Order Microservice

FastAPI + Mangum Lambda (Python 3.13, arm64) for order creation, listing,
retrieval and status updates, orchestrated through AWS Step Functions.
Restructured from the original `orders-fastapi` SAM project into the standard
MenuLay service layout, reusing the shared Lambda Layer.

## Folder structure

```
menulay-backend/
├── layers/
│   └── shared_layer/                 # ← SAME Lambda Layer as menu_svc
│       └── python/shared/            # cognito_auth, exceptions, structured_logger, …
└── services/
    └── order_svc/
        ├── handler.py                # thin Lambda entry → handler.lambda_handler
        ├── template.yaml             # SAM: SharedLayer + OrdersFunction + API
        ├── samconfig.toml
        ├── requirements.txt
        ├── requirements-dev.txt
        ├── pytest.ini
        └── app/
            ├── main.py               # FastAPI app + Mangum
            ├── api/v1/
            │   ├── __init__.py       # api_router (mounts orders at /orders)
            │   └── endpoints/
            │       └── orders.py     # POST/GET/GET{id}/PATCH{id}
            ├── core/
            │   ├── config.py         # pydantic-settings — all env vars
            │   ├── dependencies.py   # auth + tenant + repo/sfn DI
            │   └── exception_handlers.py
            ├── models/
            │   └── order.py          # domain models (OrderRequest/Record, LineItem, …)
            ├── schemas/
            │   └── order.py          # API wire models (CreateOrderBody, UpdateOrderBody)
            ├── services/
            │   ├── menu_validator.py
            │   └── channels/
            │       ├── cart_service.py   # Redis cart clear (best-effort, optional)
            │       └── sfn_service.py    # Step Functions start executions
            ├── repositories/
            │   └── order_repository.py   # DynamoDB order I/O
            └── utils/
```

## Old → new mapping

| Old (orders-fastapi)                          | New                                          |
|-----------------------------------------------|----------------------------------------------|
| `main.py`                                     | `app/main.py` + thin `handler.py`            |
| `app/routers/orders.py`                       | `app/api/v1/endpoints/orders.py`             |
| inline Pydantic bodies in the router          | `app/schemas/order.py`                        |
| `app/dependencies.py` + router DI funcs       | `app/core/dependencies.py`                   |
| exception handlers in `main.py`               | `app/core/exception_handlers.py`             |
| `orders_service/models.py`                    | `app/models/order.py`                        |
| `orders_service/menu_validator.py`            | `app/services/menu_validator.py`             |
| `orders_service/channels/cart_service.py`     | `app/services/channels/cart_service.py`      |
| `orders_service/channels/sfn_service.py`      | `app/services/channels/sfn_service.py`       |
| `orders_service/repositories/order_repository.py` | `app/repositories/order_repository.py`   |
| `shared/` (bundled in package)                | `layers/shared_layer/python/shared/` (Layer) |
| `orders_service/routes/order_routes.py`       | **removed** — legacy, never mounted by `main` |

## Key changes

- **Shared code is the same Lambda Layer** used by `menu_svc`
  (`ContentUri: ../../layers/shared_layer`). In Lambda it mounts at
  `/opt/python`, so `import shared` works unchanged. Locally, `handler.py`
  and `pytest.ini` add the layer path.
- **Handler is `handler.lambda_handler`** (was `main.handler`).
- **API request bodies moved to `app/schemas/`**, separate from the domain
  models in `app/models/order.py` — clean edge-validation vs storage-shape split.
- **template.yaml additions** (the original was missing these even though the
  code used them):
  - `states:StartExecution` IAM permission for the order-lifecycle state machine.
  - `REDIS_HOST` / `REDIS_PORT` env vars for `CartService` (still a no-op when
    host is unset or `localhost`, so behaviour is unchanged in dev).
- **`orders_service/routes/order_routes.py` dropped** — it was the pre-FastAPI
  Lambda-style routing path and was never wired into the ASGI app.

## Routes

```
POST   /orders             create order          admin / tenant
GET    /orders             list recent orders    admin / tenant / kitchen
GET    /orders/{orderId}   get one order         admin / tenant / kitchen
PATCH  /orders/{orderId}   update status flags   admin / tenant / kitchen
GET    /health             liveness              public
```

## Run locally

```bash
cd services/order_svc
pip install -r requirements.txt -r requirements-dev.txt
export PYTHONPATH=".:../../layers/shared_layer/python"
export TABLE_ORDER=cb-ml-dev-order TABLE_MENU=MenuTable-dev STEP_ARN=none SKIP_MENU=true
uvicorn app.main:app --reload --port 8001
# Swagger: http://localhost:8001/docs
```

## Deploy

```bash
cd services/order_svc
sam build
sam deploy --config-file samconfig.toml
```

> **Note:** if the shared layer is already deployed by another service, both
> stacks will each publish their own `menulay-shared-<env>` layer version. If
> you'd rather have one canonical layer, deploy it once from a dedicated stack
> and pass its ARN into each function instead of the inline `SharedLayer`
> resource — easy to switch later.
