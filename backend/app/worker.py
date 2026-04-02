from celery import Celery
from celery.schedules import crontab
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "flyingtheunit",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.collect", "app.tasks.process", "app.tasks.snapshot", "app.tasks.meme", "app.tasks.meme_pipeline"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_max_memory_per_child=512000,
    worker_concurrency=2,
)

celery_app.conf.beat_schedule = {
    "collect-all-topics": {
        "task": "app.tasks.collect.collect_all_topics",
        "schedule": crontab(minute="*/15"),
    },
    "snapshot-volumes": {
        "task": "app.tasks.snapshot.take_volume_snapshots",
        "schedule": crontab(minute=0),  # every hour
    },
    "analyze-memes": {
        "task": "app.tasks.meme.analyze_memes",
        "schedule": crontab(minute="*/20"),  # every 20 minutes
    },
    "meme-response-pipeline": {
        "task": "app.tasks.meme_pipeline.run_meme_pipeline",
        "schedule": crontab(minute="*/30"),  # every 30 minutes
    },
}
