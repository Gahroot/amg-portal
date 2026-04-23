"""Typed enum for WebSocket message type strings."""

from enum import StrEnum


class WSMessageType(StrEnum):
    """Every message-type string sent over the WebSocket protocol.

    ``StrEnum`` keeps wire values as plain strings: ``WSMessageType.AUTH_ERROR == "auth_error"``
    and ``json.dumps({"type": WSMessageType.AUTH_ERROR})`` emits ``{"type": "auth_error"}``.
    """

    # Outbound — authentication
    AUTH_ERROR = "auth_error"
    AUTH_SUCCESS = "auth_success"

    # Outbound — subscription
    SUBSCRIBED = "subscribed"
    UNSUBSCRIBED = "unsubscribed"

    # Outbound — typing
    TYPING_ACK = "typing_ack"

    # Outbound — device
    DEVICE_REGISTERED = "device_registered"

    # Outbound — preferences
    PREFERENCE_SYNC_ACK = "preference_sync_ack"
    PREFERENCE_CONFLICT = "preference_conflict"

    # Outbound — read status
    READ_STATUS_SYNC_ACK = "read_status_sync_ack"

    # Outbound — generic
    ERROR = "error"
    PONG = "pong"

    # Inbound — authentication
    AUTH = "auth"

    # Inbound — subscription
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"

    # Inbound — misc
    PING = "ping"
    TYPING = "typing"
    DEVICE_REGISTER = "device_register"
    PREFERENCE_SYNC = "preference_sync"
    READ_STATUS_SYNC = "read_status_sync"
