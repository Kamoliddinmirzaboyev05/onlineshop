from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    addresses, admin, admin_auth, auth, business, business_auth, catalog, courier,
    orders, platform, platform_auth, uploads,
)
from app.api.routes.uploads import UPLOAD_DIR
from app.core.config import settings

# Prod'da .env.example'dagi zaif default qiymatlar bilan ishga tushishni
# taqiqlaydi — noto'g'ri sozlangan deploy jim tarzda zaif kalitlar/parollar
# bilan ochilib qolmasin.
_INSECURE_DEFAULTS = {
    "secret_key": "change-me",
    "bot_token": "changeme",
    "first_admin_password": "admin12345",
    "first_platform_password": "platform12345",
}
if settings.environment == "production":
    leaked = [
        name for name, default in _INSECURE_DEFAULTS.items()
        if getattr(settings, name) == default
    ]
    if leaked:
        raise RuntimeError(
            "Production'da default (zaif) qiymatlar ishlatilmoqda — "
            f".env'da o'zgartiring: {', '.join(leaked)}"
        )

app = FastAPI(title="All Foods API", version="1.0.0")

if settings.environment == "production":
    # Faqat aniq ro'yxatdagi origin'lar (TMA_URL/ADMIN_URL/COURIER_URL + .env).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Dev'da wildcard — istalgan lokal port/tunnel bilan ishlash uchun.
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

# Yuklangan rasmlar — statik fayllar. Fayl nomi har yuklashda tasodifiy
# (uploads.py: secrets.token_hex) va hech qachon qayta yozilmaydi — shuning
# uchun uzoq/immutable kesh xavfsiz: brauzer/CDN qayta-qayta so'ramaydi.
class _CachedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        return response


app.mount("/uploads", _CachedStaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
