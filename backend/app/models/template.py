"""
SQLAlchemy model for simulation process templates.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProcessTemplate(Base):
    """
    Stores user-created simulation configuration templates.

    The `config` column holds the full SimulationParameters JSON so
    that a saved template can be re-loaded and used to start a new
    simulation without re-entering all parameters.
    """

    __tablename__ = 'process_templates'

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=True,
        default='',
    )

    config: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f'<ProcessTemplate id={self.id} name={self.name!r}>'
