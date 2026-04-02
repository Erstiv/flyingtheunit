from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()


class CharacterCreate(BaseModel):
    name: str
    handle: str | None = None
    bio: str | None = None
    property_id: str
    personality: str
    posting_rules: dict = {}


class CharacterUpdate(BaseModel):
    name: str | None = None
    handle: str | None = None
    bio: str | None = None
    personality: str | None = None
    posting_rules: dict | None = None
    is_active: bool | None = None


@router.get("/")
async def list_characters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT id, name, handle, bio, property_id, personality,
               posting_rules, engagement_stats, is_active, created_at
        FROM characters ORDER BY created_at DESC
    """))
    return [
        {
            "id": str(r.id), "name": r.name, "handle": r.handle,
            "bio": r.bio, "property_id": r.property_id,
            "personality": r.personality[:100] + "..." if r.personality and len(r.personality) > 100 else r.personality,
            "posting_rules": r.posting_rules, "engagement_stats": r.engagement_stats,
            "is_active": r.is_active, "created_at": r.created_at.isoformat(),
        }
        for r in result.fetchall()
    ]


@router.post("/", status_code=201)
async def create_character(data: CharacterCreate, db: AsyncSession = Depends(get_db)):
    import json
    result = await db.execute(text("""
        INSERT INTO characters (name, handle, bio, property_id, personality, posting_rules)
        VALUES (:name, :handle, :bio, :property_id, :personality, :posting_rules)
        RETURNING id, name, handle, property_id, created_at
    """), {
        "name": data.name,
        "handle": data.handle,
        "bio": data.bio,
        "property_id": data.property_id,
        "personality": data.personality,
        "posting_rules": json.dumps(data.posting_rules),
    })
    await db.commit()
    row = result.fetchone()
    return {
        "id": str(row.id), "name": row.name, "handle": row.handle,
        "property_id": row.property_id, "created_at": row.created_at.isoformat(),
    }


@router.get("/{character_id}")
async def get_character(character_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT * FROM characters WHERE id = :id
    """), {"id": str(character_id)})
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "Character not found")
    return {
        "id": str(row.id), "name": row.name, "handle": row.handle,
        "bio": row.bio, "property_id": row.property_id,
        "personality": row.personality, "posting_rules": row.posting_rules,
        "engagement_stats": row.engagement_stats, "is_active": row.is_active,
    }


@router.delete("/{character_id}", status_code=204)
async def delete_character(character_id: UUID, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM characters WHERE id = :id"), {"id": str(character_id)})
    await db.commit()
