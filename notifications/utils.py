
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification


logger = logging.getLogger(__name__)


def send_notification(user, message, link=''):

    # Save the notification first. Database errors should still surface.
    notification = Notification.objects.create(
        recipient=user,
        message=message,
        link=link
    )

    # Live WebSocket delivery is optional.
    try:
        channel_layer = get_channel_layer()

        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(
                f'user_{user.id}',
                {
                    'type': 'send_notification',
                    'message': message,
                    'link': link,
                    'notification_id': notification.id
                }
            )

    except Exception:
        logger.exception(
            'Live notification delivery failed for user %s',
            user.id
        )

    return notification
