
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from complaints.models import Complaint
from notifications.utils import send_notification

from .models import TaskAssignment, StaffAttendance


ACTIVE_TASK_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']


def get_online_staff(exclude_ids=None):
    """
    Return active cleaning staff members who have:
    - Checked in today
    - Not checked out
    - Sent a heartbeat within the last two minutes
    """
    exclude_ids = exclude_ids or []
    today = timezone.localdate()

    attendance_records = (
        StaffAttendance.objects
        .filter(
            attendance_date=today,
            check_in__isnull=False,
            check_out__isnull=True,
            staff_member__role='STAFF',
            staff_member__is_active=True,
        )
        .select_related('staff_member')
    )

    online_staff = []

    for attendance in attendance_records:
        if attendance.is_online:
            if attendance.staff_member_id not in exclude_ids:
                online_staff.append(attendance.staff_member)

    return online_staff


def choose_available_staff(exclude_ids=None):
    """
    Select an online staff member with the lowest active workload.
    Ties are resolved using the user's ID for predictable selection.
    """
    candidates = get_online_staff(exclude_ids=exclude_ids)

    if not candidates:
        return None

    workloads = []

    for staff_member in candidates:
        active_count = TaskAssignment.objects.filter(
            staff_member=staff_member,
            status__in=ACTIVE_TASK_STATUSES
        ).count()

        workloads.append((active_count, staff_member.id, staff_member))

    workloads.sort(key=lambda item: (item[0], item[1]))

    return workloads[0][2]


def reassign_offline_unaccepted_tasks():
    """
    Reassign only tasks that are still ASSIGNED and whose current
    worker is offline.

    ACCEPTED, IN_PROGRESS and COMPLETED tasks are never automatically
    reassigned.
    """
    reassigned_count = 0
    waiting_count = 0

    assignments = (
        TaskAssignment.objects
        .filter(status='ASSIGNED')
        .select_related('staff_member', 'complaint', 'complaint__reporter')
        .order_by('assigned_at')
    )

    for item in assignments:
        old_staff_id = item.staff_member_id
        new_staff = None
        complaint = None
        assignment_id = item.id

        with transaction.atomic():
            try:
                assignment = (
                    TaskAssignment.objects
                    .select_for_update()
                    .select_related('staff_member', 'complaint')
                    .get(id=assignment_id)
                )

                # Recheck status because the worker may have accepted
                # the task after the initial query.
                if assignment.status != 'ASSIGNED':
                    continue

                today = timezone.localdate()

                attendance = StaffAttendance.objects.filter(
                    staff_member=assignment.staff_member,
                    attendance_date=today
                ).first()

                worker_is_online = (
                    attendance.is_online if attendance else False
                )

                if worker_is_online:
                    continue

                new_staff = choose_available_staff(
                    exclude_ids=[assignment.staff_member_id]
                )

                if new_staff is None:
                    waiting_count += 1
                    continue

                complaint = assignment.complaint

                assignment.staff_member = new_staff
                assignment.status = 'ASSIGNED'
                assignment.assigned_at = timezone.now()
                assignment.save(
                    update_fields=[
                        'staff_member',
                        'status',
                        'assigned_at'
                    ]
                )

                # The complaint remains assigned.
                if complaint.status != 'ASSIGNED':
                    complaint.status = 'ASSIGNED'
                    complaint.save(update_fields=['status'])

                reassigned_count += 1

            except TaskAssignment.DoesNotExist:
                continue

        # Notifications are sent after the transaction.
        if new_staff and complaint:
            send_notification(
                User.objects.get(id=old_staff_id),
                f'Task #{assignment_id} has been reassigned because '
                f'your account went offline before accepting it.',
                '/staff/dashboard/'
            )

            send_notification(
                new_staff,
                f'New task assigned automatically: Complaint #{complaint.id}.',
                f'/staff/task/{assignment_id}/'
            )

            send_notification(
                complaint.reporter,
                f'Your complaint #{complaint.id} has been assigned to '
                f'an available cleaning staff member.',
                '/complaints/my-complaints/'
            )

    return {
        'reassigned': reassigned_count,
        'waiting': waiting_count,
    }
