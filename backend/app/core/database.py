"""Creates the SQLite database engine and provides database sessions."""

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

database_engine = create_engine(
    f"sqlite:///{settings.database_file_path}",
    connect_args={"check_same_thread": False},
)


def create_database_tables() -> None:
    """Create any database tables that do not exist yet."""
    # Importing the models package registers every table with SQLModel.
    import app.models  # noqa: F401

    SQLModel.metadata.create_all(database_engine)


def get_database_session() -> Iterator[Session]:
    """FastAPI dependency that opens a database session for one request and closes it afterwards."""
    with Session(database_engine) as database_session:
        yield database_session
