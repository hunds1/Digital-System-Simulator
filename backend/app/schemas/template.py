"""
Pydantic schemas for process template CRUD operations.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.simulation import SimulationParameters


class TemplateCreate(BaseModel):
    """Payload accepted by POST /api/templates."""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: Optional[str] = ''
    config: SimulationParameters

    def config_as_dict(self) -> dict:
        """Serialise the validated config for JSON storage."""
        return self.config.model_dump(by_alias=True, mode='json')


class TemplateResponse(BaseModel):
    """Shape returned by GET /api/templates and GET /api/templates/{id}."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = ''
    config: dict
    created_at: datetime
