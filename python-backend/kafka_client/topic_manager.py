"""Kafka topic management utilities."""
import logging
from typing import List

from confluent_kafka.admin import AdminClient, NewTopic
from confluent_kafka import KafkaException

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def ensure_topic_exists(topic: str, num_partitions: int = 1, replication_factor: int = 1):
    """
    Ensure a Kafka topic exists, creating it if necessary.

    Args:
        topic: Topic name
        num_partitions: Number of partitions (default: 1)
        replication_factor: Replication factor (default: 1)
    """
    admin_client = AdminClient({
        "bootstrap.servers": settings.kafka_brokers,
    })

    # Check if topic exists
    metadata = admin_client.list_topics(timeout=10)
    if topic in metadata.topics:
        logger.info(f"✅ Topic '{topic}' already exists")
        return True

    # Create topic
    logger.info(f"📝 Creating topic '{topic}'...")
    topic_list = [NewTopic(topic, num_partitions=num_partitions, replication_factor=replication_factor)]

    try:
        futures = admin_client.create_topics(topic_list, operation_timeout=30)

        # Wait for topic creation
        for topic_name, future in futures.items():
            try:
                future.result()  # The result itself is None
                logger.info(f"✅ Successfully created topic '{topic_name}'")
            except Exception as e:
                logger.error(f"❌ Failed to create topic '{topic_name}': {str(e)}")
                raise

        return True
    except KafkaException as e:
        logger.error(f"❌ Kafka error creating topic: {str(e)}")
        return False


def create_topics(topics: List[str], num_partitions: int = 1, replication_factor: int = 1):
    """
    Create multiple Kafka topics.

    Args:
        topics: List of topic names
        num_partitions: Number of partitions per topic
        replication_factor: Replication factor per topic
    """
    admin_client = AdminClient({
        "bootstrap.servers": settings.kafka_brokers,
    })

    # Check existing topics
    metadata = admin_client.list_topics(timeout=10)
    existing_topics = set(metadata.topics.keys())

    # Filter out existing topics
    topics_to_create = [t for t in topics if t not in existing_topics]

    if not topics_to_create:
        logger.info("✅ All topics already exist")
        return True

    logger.info(f"📝 Creating {len(topics_to_create)} topics: {topics_to_create}")
    topic_list = [
        NewTopic(topic, num_partitions=num_partitions, replication_factor=replication_factor)
        for topic in topics_to_create
    ]

    try:
        futures = admin_client.create_topics(topic_list, operation_timeout=30)

        # Wait for topic creation
        for topic_name, future in futures.items():
            try:
                future.result()
                logger.info(f"✅ Successfully created topic '{topic_name}'")
            except Exception as e:
                logger.error(f"❌ Failed to create topic '{topic_name}': {str(e)}")

        return True
    except KafkaException as e:
        logger.error(f"❌ Kafka error creating topics: {str(e)}")
        return False

