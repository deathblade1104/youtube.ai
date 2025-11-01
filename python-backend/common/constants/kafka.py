"""Kafka-related constants."""

# Kafka topics
KAFKA_TOPIC_VIDEO_UPLOADED = "video.uploaded"
KAFKA_TOPIC_VIDEO_TRANSCODED = "video.transcoded"
KAFKA_TOPIC_VIDEO_TRANSCRIBED = "video.transcribed"
KAFKA_TOPIC_VIDEO_SUMMARIZED = "video.summarized"
KAFKA_TOPIC_VIDEO_FAILED = "video.failed"

# Kafka consumer group IDs
KAFKA_GROUP_ID_TRANSCRIPTION = "python-backend-transcription"
KAFKA_GROUP_ID_SUMMARY = "python-backend-summary"

