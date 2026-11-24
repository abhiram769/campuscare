
from django.urls import path
from . import views

urlpatterns = [
    # Existing task management
    path(
        'task/<int:task_id>/',
        views.staff_task_details,
        name='staff_task_details'
    ),

    path(
        'task/<int:task_id>/update/',
        views.update_task_status,
        name='update_task_status'
    ),

    # Staff attendance
    path(
        'attendance/',
        views.staff_attendance,
        name='staff_attendance'
    ),

    path(
        'attendance/check-in/',
        views.staff_check_in,
        name='staff_check_in'
    ),

    path(
        'attendance/check-out/',
        views.staff_check_out,
        name='staff_check_out'
    ),

    path(
        'attendance/heartbeat/',
        views.staff_heartbeat,
        name='staff_heartbeat'
    ),

    # Admin attendance monitoring
    path(
        'attendance/admin/',
        views.admin_attendance,
        name='admin_attendance'
    ),
]
