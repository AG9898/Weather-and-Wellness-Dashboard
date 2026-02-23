from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import digitspan, participants, sessions, surveys

app = FastAPI(title="Weather & Wellness Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(participants.router)
app.include_router(sessions.router)
app.include_router(digitspan.router)
app.include_router(surveys.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
