
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.http import HttpResponse

from .models import Notification
from .utils import send_notification


@login_required
def test_notification(request):

    send_notification(
        request.user,
        'Campus Care real-time notifications are working!',
        '/staff/dashboard/'
    )

    return HttpResponse(
        'Test notification sent. Check your dashboard.'
    )


@login_required
def notification_list(request):

    notifications = Notification.objects.filter(
        recipient=request.user
    ).order_by('-created_at')

    unread_count = notifications.filter(is_read=False).count()

    return render(
        request,
        'notifications/notification_list.html',
        {
            'notifications': notifications,
            'unread_count': unread_count
        }
    )


@login_required
@require_POST
def mark_notification_read(request, notification_id):

    notification = get_object_or_404(
        Notification,
        id=notification_id,
        recipient=request.user
    )

    notification.is_read = True
    notification.save(update_fields=['is_read'])

    if notification.link:
        return redirect(notification.link)

    return redirect('notification_list')


@login_required
@require_POST
def mark_all_read(request):

    Notification.objects.filter(
        recipient=request.user,
        is_read=False
    ).update(is_read=True)

    return redirect('notification_list')
