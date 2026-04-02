from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import topics, posts, dashboard, graph

app = FastAPI(
    title="The Unit API",
    description="Cross-platform social intelligence & entity mapping",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topics.router, prefix="/api/topics", tags=["topics"])
app.include_router(posts.router, prefix="/api/posts", tags=["posts"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "the-unit"}
