"""Kafka producer service for publishing events."""
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient

from config import get_settings  # noqa: E402

logger = logging.getLogger(__name__)
settings = get_settings()


class KafkaProducer:
    """Kafka producer service similar to nest-be UploadKafkaProducerService."""

    def __init__(self):
        """Initialize Kafka producer."""
        self.producer = Producer(
            {
                "bootstrap.servers": settings.kafka_brokers,
                "client.id": settings.kafka_client_id,
                "acks": "all",
                "retries": 3,
                "compression.type": "snappy",
            }
        )
        logger.info(f"Kafka producer initialized: {settings.kafka_brokers}")

    def publish(
        self, topic: str, payload: Dict[str, Any], callback: Optional[callable] = None
    ) -> bool:
        """Publish message to Kafka topic."""
        try:
            message = json.dumps(payload).encode("utf-8")
            self.producer.produce(
                topic,
                message,
                callback=callback or self._delivery_callback,
            )
            self.producer.poll(0)
            logger.info(f"📤 Published to {topic}: {payload.get('id', 'N/A')}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to publish to {topic}: {str(e)}")
            return False

    def publish_video_summarized(
        self,
        video_id: int,
        summary_file_key: str,
        quality_score: Optional[float] = None,
    ) -> bool:
        """Publish video.summarized event."""
        payload = {
            "id": str(uuid.uuid4()),
            "videoId": video_id,
            "summaryFileKey": summary_file_key,
            "qualityScore": quality_score,
            "ts": datetime.utcnow().isoformat(),
        }
        return self.publish("video.summarized", payload)

    def flush(self, timeout: float = 10.0):
        """Flush pending messages."""
        self.producer.flush(timeout)

    def _delivery_callback(self, err, msg):
        """Delivery callback for Kafka messages."""
        if err:
            logger.error(f"❌ Message delivery failed: {err}")
        else:
            logger.debug(f"✅ Message delivered to {msg.topic()} [{msg.partition()}]")

    def close(self):
        """Close producer connection."""
        self.producer.flush(10)
        logger.info("Kafka producer closed")


# Singleton instance
_kafka_producer: Optional[KafkaProducer] = None


def get_kafka_producer() -> KafkaProducer:
    """Get or create Kafka producer singleton."""
    global _kafka_producer
    if _kafka_producer is None:
        _kafka_producer = KafkaProducer()
    return _kafka_producer

