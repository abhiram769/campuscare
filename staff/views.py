
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.db import transaction

from .models import TaskAssignment, CompletionEvidence
from notifications.utils import send_notification
from accounts.models import User

from datetime import datetime, time, timedelta

from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.db import IntegrityError

from .models import StaffAttendance
from django.views.decorators.csrf import ensure_csrf_cookie




@login_required
@ensure_csrf_cookie
def staff_task_details(request, task_id):

    if request.user.role != 'STAFF':
        messages.error(
            request,
            'You are not authorized to view this task.'
        )
        return redirect('login')

    task = get_object_or_404(
        TaskAssignment.objects.select_related(
            'complaint',
            'complaint__reporter'
        ),
        id=task_id,
        staff_member=request.user
    )

    return render(
        request,
        'staff/task_details.html',
        {
            'task': task
        }
    )



@login_required
@require_POST
def update_task_status(request, task_id):

    if request.user.role != 'STAFF':
        messages.error(request, 'You are not authorized.')
        return redirect('login')

    task = get_object_or_404(
        TaskAssignment.objects.select_related(
            'complaint',
            'complaint__reporter'
        ),
        id=task_id,
        staff_member=request.user
    )

    action = request.POST.get('action')

    # -----------------------------------
    # 1. ACCEPT TASK
    # -----------------------------------

    if action == 'accept' and task.status == 'ASSIGNED':

        with transaction.atomic():
            task.status = 'ACCEPTED'
            task.complaint.status = 'ACCEPTED'

            task.save(update_fields=['status'])
            task.complaint.save(update_fields=['status'])

        send_notification(
            task.complaint.reporter,
            f'Your complaint #{task.complaint.id} has been accepted by cleaning staff.',
            '/complaints/my-complaints/'
        )

    # -----------------------------------
    # 2. START WORK
    # -----------------------------------

    elif action == 'start' and task.status == 'ACCEPTED':

        with transaction.atomic():
            task.status = 'IN_PROGRESS'
            task.complaint.status = 'IN_PROGRESS'

            task.save(update_fields=['status'])
            task.complaint.save(update_fields=['status'])

        admin_users = User.objects.filter(role='ADMIN')

        for admin in admin_users:
            send_notification(
                admin,
                f'Work has started on complaint #{task.complaint.id}.',
                '/admin/dashboard/'
            )

    # -----------------------------------
    # 3. COMPLETE TASK
    # -----------------------------------

    elif action == 'complete' and task.status == 'IN_PROGRESS':

        image = request.FILES.get('completion_image')

        if not image:
            messages.error(
                request,
                'Please upload a completion photo.'
            )
            return redirect('staff_task_details', task_id=task.id)

        if image.size > 5 * 1024 * 1024:
            messages.error(
                request,
                'Image must be smaller than 5 MB.'
            )
            return redirect('staff_task_details', task_id=task.id)

        if image.content_type not in [
            'image/jpeg',
            'image/png',
            'image/webp'
        ]:
            messages.error(
                request,
                'Only JPG, PNG and WEBP images are allowed.'
            )
            return redirect('staff_task_details', task_id=task.id)

        with transaction.atomic():

            CompletionEvidence.objects.create(
                assignment=task,
                image=image
            )

            task.status = 'COMPLETED'
            task.complaint.status = 'COMPLETED'

            task.save(update_fields=['status'])
            task.complaint.save(update_fields=['status'])

        # Notify the student/faculty who submitted the complaint
        send_notification(
            task.complaint.reporter,
            f'Your complaint #{task.complaint.id} has been completed!',
            '/complaints/my-complaints/'
        )

        # Notify all administrators
        admin_users = User.objects.filter(role='ADMIN')

        for admin in admin_users:
            send_notification(
                admin,
                f'Complaint #{task.complaint.id} has been marked as completed.',
                '/admin/dashboard/'
            )

    else:
        messages.error(request, 'Invalid task action.')
        return redirect('staff_task_details', task_id=task.id)

    messages.success(
        request,
        'Task status updated successfully!'
    )

    return redirect('staff_task_details', task_id=task.id)

# =====================================================
# ATTENDANCE CONFIGURATION
# =====================================================

DUTY_START = time(7, 0)
LATE_AFTER = time(7, 30)
DUTY_END = time(15, 0)


def get_local_now():
    return timezone.localtime(timezone.now())


def is_working_day(day):
    # Monday = 0, Sunday = 6
    return day.weekday() != 6


def get_today_attendance(user):
    today = get_local_now().date()

    return StaffAttendance.objects.filter(
        staff_member=user,
        attendance_date=today
    ).first()


# =====================================================
# CREATE ABSENT RECORDS AFTER THE GRACE PERIOD
# =====================================================

def create_absent_records():

    now = get_local_now()

    if not is_working_day(now.date()):
        return

    if now.time() <= LATE_AFTER:
        return

    staff_members = User.objects.filter(role='STAFF')

    for staff_member in staff_members:

        StaffAttendance.objects.get_or_create(
            staff_member=staff_member,
            attendance_date=now.date(),
            defaults={
                'status': 'ABSENT'
            }
        )


# =====================================================
# STAFF ATTENDANCE PAGE
# =====================================================

@login_required
def staff_attendance(request):

    if request.user.role != 'STAFF':
        return redirect('login')

    create_absent_records()

    today_attendance = get_today_attendance(request.user)

    attendance_history = StaffAttendance.objects.filter(
        staff_member=request.user
    ).order_by('-attendance_date')[:30]

    context = {
        'attendance': today_attendance,
        'attendance_history': attendance_history,
        'is_working_day': is_working_day(get_local_now().date()),
        'duty_start': '07:00 AM',
        'duty_end': '03:00 PM',
        'late_after': '07:30 AM',
    }

    return render(
        request,
        'staff/attendance.html',
        context
    )


# =====================================================
# STAFF CHECK-IN
# =====================================================

@login_required
@require_POST
def staff_check_in(request):

    if request.user.role != 'STAFF':
        return JsonResponse(
            {'success': False, 'message': 'Unauthorized'},
            status=403
        )

    now = get_local_now()

    if not is_working_day(now.date()):
        return JsonResponse({
            'success': False,
            'message': 'Today is not a scheduled working day.'
        }, status=400)

    try:
        attendance, created = StaffAttendance.objects.get_or_create(
            staff_member=request.user,
            attendance_date=now.date(),
            defaults={
                'check_in': now,
                'last_seen': now,
                'status': (
                    'LATE'
                    if now.time() > LATE_AFTER
                    else 'PRESENT'
                )
            }
        )

    except IntegrityError:
        attendance = StaffAttendance.objects.get(
            staff_member=request.user,
            attendance_date=now.date()
        )
        created = False

    if not created:

        if attendance.check_in:
            return JsonResponse({
                'success': False,
                'message': 'You have already checked in today.'
            }, status=400)

        attendance.check_in = now
        attendance.check_out = None
        attendance.last_seen = now
        attendance.status = (
            'LATE'
            if now.time() > LATE_AFTER
            else 'PRESENT'
        )

        attendance.save()

    return JsonResponse({
        'success': True,
        'message': 'Check-in successful!',
        'check_in': timezone.localtime(
            attendance.check_in
        ).strftime('%I:%M %p'),
        'status': attendance.get_status_display()
    })


# =====================================================
# STAFF CHECK-OUT
# =====================================================

@login_required
@require_POST
def staff_check_out(request):

    if request.user.role != 'STAFF':
        return JsonResponse(
            {'success': False, 'message': 'Unauthorized'},
            status=403
        )

    now = get_local_now()

    attendance = get_today_attendance(request.user)

    if not attendance or not attendance.check_in:
        return JsonResponse({
            'success': False,
            'message': 'You must check in before checking out.'
        }, status=400)

    if attendance.check_out:
        return JsonResponse({
            'success': False,
            'message': 'You have already checked out today.'
        }, status=400)

    if now <= attendance.check_in:
        return JsonResponse({
            'success': False,
            'message': 'Invalid check-out time.'
        }, status=400)

    attendance.check_out = now
    attendance.last_seen = now
    attendance.save(update_fields=['check_out', 'last_seen'])

    return JsonResponse({
        'success': True,
        'message': 'Check-out successful!',
        'working_hours': attendance.working_hours_display
    })


# =====================================================
# STAFF ONLINE HEARTBEAT
# =====================================================

@login_required
@require_POST
def staff_heartbeat(request):

    if request.user.role != 'STAFF':
        return JsonResponse({
            'success': False,
            'message': 'Unauthorized'
        }, status=403)

    now = get_local_now()

    # Never allow presence updates on Sunday.
    if not is_working_day(now.date()):
        return JsonResponse({
            'success': False,
            'message': 'Today is not a scheduled working day.'
        }, status=400)

    attendance = get_today_attendance(request.user)

    if not attendance or not attendance.check_in:
        return JsonResponse({
            'success': False,
            'message': 'Please check in first.'
        }, status=400)

    if attendance.check_out:
        return JsonResponse({
            'success': False,
            'message': 'You have already checked out.'
        }, status=400)

    attendance.last_seen = now
    attendance.save(update_fields=['last_seen'])

    return JsonResponse({
        'success': True,
        'online': True,
        'message': 'Presence updated successfully.'
    })



# =====================================================
# ADMIN ATTENDANCE OVERVIEW
# =====================================================

@login_required
def admin_attendance(request):

    if request.user.role != 'ADMIN':
        return redirect('login')

    create_absent_records()

    today = get_local_now().date()

    staff_members = User.objects.filter(
        role='STAFF'
    ).order_by('username')

    attendance_records = StaffAttendance.objects.filter(
        attendance_date=today
    ).select_related('staff_member')

    attendance_by_staff = {
        record.staff_member_id: record
        for record in attendance_records
    }

    staff_rows = []

    online_count = 0
    absent_count = 0
    present_count = 0
    late_count = 0

    for staff_member in staff_members:

        record = attendance_by_staff.get(staff_member.id)

        online = record.is_online if record else False

        if online:
            online_count += 1

        if record:
            if record.status == 'ABSENT':
                absent_count += 1
            elif record.status == 'LATE':
                late_count += 1
            else:
                present_count += 1

        else:
            # Before 7:30 AM, no attendance means not yet reported.
            pass

        staff_rows.append({
            'staff': staff_member,
            'attendance': record,
            'online': online,
        })

    context = {
        'staff_rows': staff_rows,
        'total_staff': staff_members.count(),
        'online_count': online_count,
        'absent_count': absent_count,
        'present_count': present_count,
        'late_count': late_count,
        'attendance_date': today,
    }

    return render(
        request,
        'admin/attendance.html',
        context
    )
