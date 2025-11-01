"""Video-related type definitions."""
from typing import Dict, List, Optional, TypedDict


class VideoTranscodedPayload(TypedDict, total=False):
    """Payload for video.transcoded event."""

    id: str  # Event ID (UUID)
    eventId: str  # Alternative event ID (from outbox)
    videoId: int
    variants: List[Dict[str, any]]
    ts: str  # ISO timestamp


class VideoTranscribedPayload(TypedDict, total=False):
    """Payload for video.transcribed event."""

    id: str  # Event ID (UUID)
    eventId: str  # Alternative event ID (from outbox)
    videoId: int
    transcriptFileKey: str
    snippetCount: int
    ts: str  # ISO timestamp


class VideoSummaryPayload(TypedDict, total=False):
    """Payload for video.summarized event."""

    id: str  # Event ID (UUID)
    eventId: str  # Alternative event ID (from outbox)
    videoId: int
    summaryText: str
    ts: str  # ISO timestamp

