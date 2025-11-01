#!/usr/bin/env python3
"""Script to create required Kafka topics."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from kafka_client.topic_manager import create_topics

# Required topics for the YouTube AI system
REQUIRED_TOPICS = [
    "video.transcribed",  # Input topic for Python backend
    "video.summarized",   # Output topic from Python backend
    "video.uploaded",     # From nest-be
    "video.transcoded",   # From nest-be
]

if __name__ == "__main__":
    print("📝 Creating required Kafka topics...")
    success = create_topics(REQUIRED_TOPICS, num_partitions=1, replication_factor=1)

    if success:
        print("✅ All topics created successfully!")
        sys.exit(0)
    else:
        print("❌ Failed to create some topics")
        sys.exit(1)

