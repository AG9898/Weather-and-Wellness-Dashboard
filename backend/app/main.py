from fastapi import FastAPI

from app.routers import participants as participants_router


app = FastAPI(title="Weather & Wellness Backend", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# Register routers
app.include_router(participants_router.router)
