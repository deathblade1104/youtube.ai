"""Base exception classes."""


class YouTubeAIBackendException(Exception):
    """Base exception for YouTube AI Backend."""

    def __init__(self, message: str, details: dict = None):
        """Initialize exception."""
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ServiceException(YouTubeAIBackendException):
    """Exception raised by services."""

    pass


class ValidationException(YouTubeAIBackendException):
    """Exception raised for validation errors."""

    pass


class NotFoundException(YouTubeAIBackendException):
    """Exception raised when resource is not found."""

    pass


class ProcessingException(YouTubeAIBackendException):
    """Exception raised during video processing."""

    pass

