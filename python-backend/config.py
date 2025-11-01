"""Configuration management using pydantic settings."""
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore extra fields from nest-be .env
    )

    # Server
    port: int = Field(default=8081, alias="PORT")
    node_env: str = Field(default="development", alias="NODE_ENV")

    # Host IP (optional, can be derived from other settings)
    host_ip: str = Field(default="", alias="HOST_IP")

    # Database
    db_host: str = Field(..., alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    pg_user: str = Field(..., alias="PG_USER")
    pg_password: str = Field(..., alias="PG_PASSWORD")
    db_name: str = Field(default="postgres", alias="DB_NAME")
    db_schema: str = Field(default="youtube", alias="DB_SCHEMA")

    # Redis
    redis_host: str = Field(..., alias="REDIS_HOST")
    redis_port: int = Field(default=6379, alias="REDIS_PORT")
    redis_password: str = Field(default="", alias="REDIS_PASSWORD")
    redis_ttl: int = Field(default=3600, alias="REDIS_TTL")

    # Kafka
    kafka_brokers: str = Field(..., alias="KAFKA_BROKERS")
    kafka_client_id: str = Field(default="youtube-ai-python", alias="KAFKA_CLIENT_ID")
    kafka_group_id: str = Field(
        default="youtube-consumer-group-python", alias="KAFKA_GROUP_ID"
    )

    # AWS S3
    aws_region: str = Field(default="ap-south-1", alias="AWS_REGION")
    aws_access_key_id: str = Field(..., alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(..., alias="AWS_SECRET_ACCESS_KEY")
    aws_youtube_bucket: str = Field(..., alias="AWS_YOUTUBE_BUCKET")
    use_localstack: bool = Field(default=False, alias="USE_LOCALSTACK")
    aws_s3_endpoint: str = Field(default="", alias="AWS_S3_ENDPOINT")

    # OpenAI
    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")

    # Celery (can be auto-constructed from Redis settings)
    celery_broker_url: str = Field(default="", alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="", alias="CELERY_RESULT_BACKEND")

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # Database synchronization (similar to TypeORM synchronize)
    db_sync: bool = Field(default=True, alias="DB_SYNC")

    @property
    def database_url(self) -> str:
        """Construct PostgreSQL connection URL."""
        return (
            f"postgresql://{self.pg_user}:{self.pg_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def kafka_broker_list(self) -> List[str]:
        """Parse Kafka brokers from comma-separated string."""
        return [broker.strip() for broker in self.kafka_brokers.split(",")]

    @property
    def celery_broker_url_resolved(self) -> str:
        """Resolve Celery broker URL from Redis settings if not provided."""
        if self.celery_broker_url:
            return self.celery_broker_url
        # Redis URL format: redis://[:password@]host:port/db
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/0"
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @property
    def celery_result_backend_resolved(self) -> str:
        """Resolve Celery result backend from Redis settings if not provided."""
        if self.celery_result_backend:
            return self.celery_result_backend
        # Redis URL format: redis://[:password@]host:port/db
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/0"
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.node_env.lower() == "production"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

