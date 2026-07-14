from app.database.session import Base, engine, get_db, SessionLocal  # noqa: F401


def init_db() -> None:
    """
    Create all tables. In production you'd use Alembic migrations instead of
    create_all - this is provided for fast local/dev bootstrapping and for
    the docker-compose demo environment.
    """
    # Import models so they're registered on Base.metadata before create_all
    from app.auth import models as auth_models  # noqa: F401
    from app.users import models as user_models  # noqa: F401
    from app.files import models as file_models  # noqa: F401
    from app.sharing import models as sharing_models  # noqa: F401
    from app.analytics import models as analytics_models  # noqa: F401

    Base.metadata.create_all(bind=engine)
