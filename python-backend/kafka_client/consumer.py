"""Kafka consumer service for consuming events."""
import json
import logging
import signal
import sys
import time
from threading import Event
from typing import Callable, Dict

from confluent_kafka import Consumer, KafkaError, KafkaException
from confluent_kafka.admin import AdminClient

from config import get_settings
from kafka_client.topic_manager import ensure_topic_exists

logger = logging.getLogger(__name__)
settings = get_settings()


class KafkaConsumer:
    """Kafka consumer service for consuming video events."""

    def __init__(self, topic: str, handler: Callable[[Dict], None], create_topic: bool = True):
        """Initialize Kafka consumer."""
        self.topic = topic
        self.handler = handler

        # Ensure topic exists before subscribing
        if create_topic:
            ensure_topic_exists(topic, num_partitions=1, replication_factor=1)

        self.consumer = Consumer(
            {
                "bootstrap.servers": settings.kafka_brokers,
                "group.id": settings.kafka_group_id,
                "auto.offset.reset": "earliest",
                "enable.auto.commit": True,
                "session.timeout.ms": 30000,
            }
        )
        self.consumer.subscribe([topic])
        self.running = False
        self.shutdown_event = Event()

        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        logger.info(f"Kafka consumer initialized for topic: {topic}")

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}, shutting down...")
        self.shutdown_event.set()

    def consume(self):
        """Start consuming messages."""
        self.running = True
        logger.info(f"🚀 Starting to consume messages from {self.topic}")

        try:
            while not self.shutdown_event.is_set():
                msg = self.consumer.poll(timeout=1.0)

                if msg is None:
                    continue

                if msg.error():
                    error_code = msg.error().code()
                    if error_code == KafkaError._PARTITION_EOF:
                        logger.debug(
                            f"Reached end of partition {msg.partition()}, offset {msg.offset()}"
                        )
                    elif error_code == KafkaError.UNKNOWN_TOPIC_OR_PART:
                        logger.warning(
                            f"⚠️ Topic '{self.topic}' does not exist. Attempting to create..."
                        )
                        # Try to create topic and retry
                        if ensure_topic_exists(self.topic):
                            logger.info(f"✅ Topic '{self.topic}' created, retrying subscription...")
                            time.sleep(2)  # Wait a bit for topic to be ready
                        else:
                            logger.error(f"❌ Failed to create topic '{self.topic}'")
                            continue
                    else:
                        logger.error(f"Consumer error: {msg.error()}")
                    continue

                try:
                    # Parse message
                    payload = json.loads(msg.value().decode("utf-8"))
                    logger.info(
                        f"📥 Received message from {self.topic}: {payload.get('id', 'N/A')}"
                    )

                    # Call handler
                    self.handler(payload)

                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse message: {str(e)}")
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")

        except KafkaException as e:
            logger.error(f"Kafka exception: {str(e)}")
        finally:
            self.consumer.close()
            logger.info("Kafka consumer closed")

    def close(self):
        """Close consumer connection."""
        self.shutdown_event.set()
        self.consumer.close()


def create_consumer(topic: str, handler: Callable[[Dict], None]) -> KafkaConsumer:
    """Create and return a Kafka consumer."""
    return KafkaConsumer(topic, handler)

