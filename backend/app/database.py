"""
Database connection setup for PostgreSQL via SQLAlchemy.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# DATABASE_URL from environment (set in docker-compose.yml), with a sensible default
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://simulator:simulator@db:5432/simulator',
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Declarative base for all SQLAlchemy models."""
    pass


def get_db():
    """FastAPI dependency that yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
