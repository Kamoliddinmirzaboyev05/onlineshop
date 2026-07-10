from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    addresses, admin, admin_auth, auth, business, business_auth, catalog, courier,
    orders, platform, platform_auth, uploads,
)
from app.api.routes.uploads import UPLOAD_DIR

app = FastAPI(title="All Foods API", version="1.0.0")

# ponytail: CORS vaqtincha HAMMA origin'ga ochiq (development). Yopish uchun
# quyidagini `if settings.environment == "production": allow_origins=settings.cors_origins`
# guardi bilan almashtiring. `allow_origin_regex=".*"` (allow_origins=["*"] emas) —
# credentials bilan ishlashi uchun brauzerga so'rov Origin'ini qaytaradi.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(catalog.router)
api.include_router(addresses.router)
api.include_router(orders.router)
api.include_router(admin_auth.router)
api.include_router(admin.router)
api.include_router(courier.router)
api.include_router(uploads.router)
api.include_router(business.router)
api.include_router(business_auth.router)
api.include_router(platform.router)
api.include_router(platform_auth.router)

app.include_router(api)

# Yuklangan rasmlar — statik fayllar.
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
