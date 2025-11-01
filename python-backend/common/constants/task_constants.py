"""Task retry configuration constants matching BullMQ patterns."""

# Retry configuration matching BullMQ job options
TRANSCRIPTION_TASK_CONFIG = {
    "max_retries": 3,
    "initial_retry_delay": 10,  # 10 seconds (matches TRANSCRIBE_JOB_OPTIONS)
    "backoff_type": "exponential",  # exponential backoff like BullMQ
}

SUMMARY_TASK_CONFIG = {
    "max_retries": 3,
    "initial_retry_delay": 5,  # 5 seconds (matches TRANSCODE_JOB_OPTIONS)
    "backoff_type": "exponential",  # exponential backoff like BullMQ
}


def calculate_exponential_backoff_delay(
    initial_delay: int, retry_count: int, max_delay: int = 300
) -> int:
    """
    Calculate exponential backoff delay.

    Formula: delay = initial_delay * (2 ^ retry_count)
    Matches BullMQ exponential backoff behavior.

    Args:
        initial_delay: Initial delay in seconds (e.g., 5, 10)
        retry_count: Current retry attempt number (0-indexed)
        max_delay: Maximum delay in seconds (default: 300s = 5 minutes)

    Returns:
        Delay in seconds
    """
    delay = initial_delay * (2 ** retry_count)
    return min(delay, max_delay)

