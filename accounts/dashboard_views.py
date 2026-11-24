
from functools import wraps

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.contrib import messages
from django.db import transaction
from django.db.models import Avg
from django.utils import timezone

from complaints.models import Complaint, Feedback

from staff.models import TaskAssignment, StaffAttendance
from staff.forms import TaskAssignmentForm

from notifications.utils import send_notification


# =====================================================
# ROLE-BASED ACCESS CONTROL
# =====================================================

def role_required(role):

    def decorator(view_func):

        @login_required
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):

            if request.user.role != role:
                return HttpResponseForbidden(
                    'You are not authorized to access this page.'
                )

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


# =====================================================
# STUDENT AND FACULTY DASHBOARD DATA
# =====================================================

def get_complaint_dashboard_data(user):

    complaints = Complaint.objects.filter(reporter=user)

    total_complaints = complaints.count()

    completed_complaints = complaints.filter(
        status='COMPLETED'
    ).count()

    pending_complaints = complaints.exclude(
        status__in=['COMPLETED', 'DUPLICATE']
    ).count()

    recent_complaints = complaints.order_by(
        '-created_at'
    )[:5]

    status_options = [
        ('SUBMITTED', 'Submitted'),
        ('UNDER_REVIEW', 'Under Review'),
        ('ASSIGNED', 'Assigned'),
        ('ACCEPTED', 'Accepted'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('DUPLICATE', 'Duplicate'),
    ]

    status_chart_labels = []
    status_chart_data = []

    for status_code, status_label in status_options:

        status_chart_labels.append(status_label)

        status_chart_data.append(
            complaints.filter(status=status_code).count()
        )

    return {
        'total_complaints': total_complaints,
        'completed_complaints': completed_complaints,
        'pending_complaints': pending_complaints,
        'recent_complaints': recent_complaints,
        'status_chart_labels': status_chart_labels,
        'status_chart_data': status_chart_data,
    }


# =====================================================
# STUDENT DASHBOARD
# =====================================================

@role_required('STUDENT')
def student_dashboard(request):

    context = get_complaint_dashboard_data(request.user)

    return render(
        request,
        'student/dashboard.html',
        context
    )


# =====================================================
# FACULTY DASHBOARD
# =====================================================

@role_required('FACULTY')
def faculty_dashboard(request):

    context = get_complaint_dashboard_data(request.user)

    return render(
        request,
        'faculty/dashboard.html',
        context
    )


# =====================================================
# CLEANING STAFF DASHBOARD
# =====================================================

@role_required('STAFF')
def staff_dashboard(request):

    tasks = (
        TaskAssignment.objects
        .filter(staff_member=request.user)
        .select_related('complaint')
        .order_by('-assigned_at')
    )

    total_tasks = tasks.count()

    pending_tasks = tasks.filter(
        status__in=['ASSIGNED', 'ACCEPTED']
    ).count()

    in_progress_tasks = tasks.filter(
        status='IN_PROGRESS'
    ).count()

    completed_tasks = tasks.filter(
        status='COMPLETED'
    ).count()

    today = timezone.localdate()

    today_attendance = StaffAttendance.objects.filter(
        staff_member=request.user,
        attendance_date=today
    ).first()

    is_working_day = today.weekday() != 6

    is_online = (
        today_attendance.is_online
        if today_attendance else False
    )

    context = {
        'tasks': tasks,
        'total_tasks': total_tasks,
        'pending_tasks': pending_tasks,
        'in_progress_tasks': in_progress_tasks,
        'completed_tasks': completed_tasks,
        'today_attendance': today_attendance,
        'is_working_day': is_working_day,
        'today': today,
        'is_online': is_online,
    }

    return render(
        request,
        'staff/dashboard.html',
        context
    )


# =====================================================
# ADMIN DASHBOARD
# =====================================================

@role_required('ADMIN')
def admin_dashboard(request):

    complaints = Complaint.objects.select_related(
        'reporter'
    ).order_by('-created_at')

    total = complaints.count()

    pending = complaints.filter(
        status__in=['SUBMITTED', 'UNDER_REVIEW']
    ).count()

    assigned = complaints.filter(
        status='ASSIGNED'
    ).count()

    completed = complaints.filter(
        status='COMPLETED'
    ).count()

    # -----------------------------------------
    # FEEDBACK
    # -----------------------------------------

    feedbacks = Feedback.objects.select_related(
        'complaint',
        'reporter',
        'staff_member'
    ).order_by('-created_at')

    total_feedback = feedbacks.count()

    average_rating = feedbacks.aggregate(
        average=Avg('rating')
    )['average'] or 0

    five_star_count = feedbacks.filter(
        rating=5
    ).count()

    recent_feedback = feedbacks[:5]

    context = {
        'complaints': complaints,
        'total': total,
        'pending': pending,
        'assigned': assigned,
        'completed': completed,

        'total_feedback': total_feedback,
        'average_rating': average_rating,
        'five_star_count': five_star_count,
        'recent_feedback': recent_feedback,
    }

    return render(
        request,
        'admin/dashboard.html',
        context
    )


# =====================================================
# ADMIN: VIEW ALL FEEDBACK
# =====================================================

@role_required('ADMIN')
def admin_feedback(request):

    feedbacks = Feedback.objects.select_related(
        'complaint',
        'reporter',
        'staff_member'
    ).order_by('-created_at')

    return render(
        request,
        'admin/feedback.html',
        {
            'feedbacks': feedbacks,
        }
    )


# =====================================================
# ADMIN: ASSIGN COMPLAINT TO CLEANING STAFF
# =====================================================

@role_required('ADMIN')
def assign_complaint(request, complaint_id):

    complaint = get_object_or_404(
        Complaint,
        id=complaint_id
    )

    # Never allow reassignment of completed complaints
    # or complaints marked as duplicate.

    if complaint.status in ['COMPLETED', 'DUPLICATE']:

        messages.error(
            request,
            f'Complaint #{complaint.id} cannot be assigned. '
            f'Current status: {complaint.get_status_display()}.'
        )

        return redirect('admin_dashboard')

    if request.method == 'POST':

        form = TaskAssignmentForm(request.POST)

        if form.is_valid():

            staff_member = form.cleaned_data['staff_member']

            with transaction.atomic():

                # Check again inside the transaction
                complaint = Complaint.objects.select_for_update().get(
                    id=complaint_id
                )

                if complaint.status in ['COMPLETED', 'DUPLICATE']:

                    messages.error(
                        request,
                        'This complaint can no longer be assigned.'
                    )

                    return redirect('admin_dashboard')

                assignment = TaskAssignment.objects.filter(
                    complaint=complaint
                ).first()

                if assignment:

                    assignment.staff_member = staff_member
                    assignment.assigned_by = request.user
                    assignment.status = 'ASSIGNED'
                    assignment.save()

                else:

                    assignment = TaskAssignment.objects.create(
                        complaint=complaint,
                        staff_member=staff_member,
                        assigned_by=request.user
                    )

                complaint.status = 'ASSIGNED'

                complaint.save(
                    update_fields=['status']
                )

            # Notify assigned cleaning staff
            send_notification(
                staff_member,
                f'New task assigned: Complaint #{complaint.id}',
                f'/staff/task/{assignment.id}/'
            )

            # Notify complaint reporter
            send_notification(
                complaint.reporter,
                f'Your complaint #{complaint.id} has been assigned to cleaning staff.',
                '/complaints/my-complaints/'
            )

            messages.success(
                request,
                f'Complaint #{complaint.id} assigned successfully!'
            )

            return redirect('admin_dashboard')

    else:

        form = TaskAssignmentForm()

    return render(
        request,
        'admin/assign_complaint.html',
        {
            'complaint': complaint,
            'form': form
        }
    )
