
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.db import transaction

from complaints.models import Complaint
from staff.models import TaskAssignment
from staff.forms import TaskAssignmentForm
from staff.assignment_engine import (
    choose_available_staff,
    reassign_offline_unaccepted_tasks,
)
from notifications.utils import send_notification


@login_required
def assign_complaint(request, complaint_id):

    if request.user.role != 'ADMIN':
        return redirect('login')

    complaint = get_object_or_404(
        Complaint.objects.select_related('reporter'),
        id=complaint_id
    )

    if complaint.status in ['COMPLETED', 'DUPLICATE']:
        messages.error(
            request,
            f'Complaint #{complaint.id} cannot be assigned.'
        )
        return redirect('admin_dashboard')

    existing_assignment = TaskAssignment.objects.filter(
        complaint=complaint
    ).first()

    if existing_assignment and existing_assignment.status in [
        'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'
    ]:
        messages.error(
            request,
            'This task has already been accepted or started. '
            'It cannot be reassigned through this page.'
        )
        return redirect('admin_dashboard')

    if request.method == 'POST':

        form = TaskAssignmentForm(request.POST)

        if form.is_valid():

            mode = form.cleaned_data['assignment_mode']

            if mode == 'AUTO':
                excluded_ids = []

                if existing_assignment:
                    excluded_ids.append(
                        existing_assignment.staff_member_id
                    )

                staff_member = choose_available_staff(
                    exclude_ids=excluded_ids
                )

                if not staff_member:
                    messages.error(
                        request,
                        'No cleaning staff member is currently online. '
                        'Please try again when a worker checks in.'
                    )
                    return render(
                        request,
                        'admin/assign_complaint.html',
                        {
                            'complaint': complaint,
                            'form': form,
                        }
                    )

            else:
                staff_member = form.cleaned_data['staff_member']

            old_staff = None

            with transaction.atomic():

                complaint = (
                    Complaint.objects
                    .select_for_update()
                    .select_related('reporter')
                    .get(id=complaint_id)
                )

                if complaint.status in ['COMPLETED', 'DUPLICATE']:
                    messages.error(
                        request,
                        'This complaint can no longer be assigned.'
                    )
                    return redirect('admin_dashboard')

                assignment = (
                    TaskAssignment.objects
                    .select_for_update()
                    .filter(complaint=complaint)
                    .first()
                )

                if assignment:
                    if assignment.status in [
                        'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'
                    ]:
                        messages.error(
                            request,
                            'The task has already been accepted or started.'
                        )
                        return redirect('admin_dashboard')

                    old_staff = assignment.staff_member

                    assignment.staff_member = staff_member
                    assignment.assigned_by = request.user
                    assignment.status = 'ASSIGNED'
                    assignment.assigned_at = __import__(
                        'django.utils.timezone',
                        fromlist=['now']
                    ).now()

                    assignment.save()

                else:
                    assignment = TaskAssignment.objects.create(
                        complaint=complaint,
                        staff_member=staff_member,
                        assigned_by=request.user,
                        status='ASSIGNED'
                    )

                complaint.status = 'ASSIGNED'
                complaint.save(update_fields=['status'])

            # Notify the previous worker if this was a reassignment.
            if old_staff and old_staff.id != staff_member.id:
                send_notification(
                    old_staff,
                    f'Complaint #{complaint.id} has been reassigned.',
                    '/staff/dashboard/'
                )

            send_notification(
                staff_member,
                f'New task assigned: Complaint #{complaint.id}',
                f'/staff/task/{assignment.id}/'
            )

            send_notification(
                complaint.reporter,
                f'Your complaint #{complaint.id} has been assigned '
                f'to cleaning staff.',
                '/complaints/my-complaints/'
            )

            messages.success(
                request,
                f'Complaint #{complaint.id} assigned successfully to '
                f'{staff_member.username}.'
            )

            return redirect('admin_dashboard')

    else:
        form = TaskAssignmentForm()

    return render(
        request,
        'admin/assign_complaint.html',
        {
            'complaint': complaint,
            'form': form,
        }
    )


@login_required
def admin_assignment_monitor(request):

    if request.user.role != 'ADMIN':
        return JsonResponse(
            {'success': False, 'message': 'Unauthorized'},
            status=403
        )

    result = reassign_offline_unaccepted_tasks()

    return JsonResponse({
        'success': True,
        'reassigned': result['reassigned'],
        'waiting': result['waiting'],
    })
