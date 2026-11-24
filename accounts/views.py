
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import SetPasswordForm
from django.contrib import messages
from django.http import HttpResponseForbidden
from django.views.decorators.http import require_POST

from .forms import (
    RegistrationForm,
    StaffCreationForm,
    StaffUpdateForm
)

from .models import User

from staff.models import (
    TaskAssignment,
    StaffAttendance
)


# =====================================================
# STUDENT / FACULTY REGISTRATION
# =====================================================

def register(request, role):

    # Public registration is allowed only for students
    # and faculty members.

    if role not in ['STUDENT', 'FACULTY']:
        return redirect('login')

    if request.method == 'POST':

        form = RegistrationForm(request.POST)

        if form.is_valid():

            user = form.save(commit=False)

            user.role = role

            user.save()

            messages.success(
                request,
                'Registration successful! Please login.'
            )

            return redirect('login')

    else:

        form = RegistrationForm()

    return render(
        request,
        'accounts/register.html',
        {
            'form': form,
            'role': role
        }
    )


# =====================================================
# LOGIN
# =====================================================

def user_login(request):

    if request.method == 'POST':

        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(
            request,
            username=username,
            password=password
        )

        if user is not None:

            login(request, user)

            if user.role == 'STUDENT':
                return redirect('student_dashboard')

            elif user.role == 'FACULTY':
                return redirect('faculty_dashboard')

            elif user.role == 'STAFF':
                return redirect('staff_dashboard')

            elif user.role == 'ADMIN':
                return redirect('admin_dashboard')

            logout(request)

            messages.error(
                request,
                'Your account does not have a valid role.'
            )

        else:

            messages.error(
                request,
                'Invalid username or password.'
            )

    return render(
        request,
        'accounts/login.html'
    )


# =====================================================
# LOGOUT
# =====================================================

@login_required
def user_logout(request):

    logout(request)

    return redirect('login')


# =====================================================
# LANDING PAGE
# =====================================================


def landing_page(request):
    return render(request, 'landing.html')


# =====================================================
# ADMIN: CREATE AND LIST CLEANING STAFF
# =====================================================

@login_required
def admin_staff_management(request):

    if request.user.role != 'ADMIN':

        return HttpResponseForbidden(
            'Only administrators can manage cleaning staff accounts.'
        )

    if request.method == 'POST':

        form = StaffCreationForm(request.POST)

        if form.is_valid():

            staff_user = form.save(commit=False)

            # The role is assigned by the server.
            # It is never accepted from the submitted form.

            staff_user.role = 'STAFF'
            staff_user.is_active = True

            staff_user.save()

            messages.success(
                request,
                f'Worker account created successfully for '
                f'{staff_user.get_full_name() or staff_user.username}. '
                f'Username: {staff_user.username}'
            )

            return redirect('admin_staff_management')

        messages.error(
            request,
            'Please correct the errors in the worker creation form.'
        )

    else:

        form = StaffCreationForm()

    staff_members = User.objects.filter(
        role='STAFF'
    ).order_by('-date_joined')

    context = {
        'form': form,
        'staff_members': staff_members,
        'total_staff': staff_members.count(),
        'active_staff': staff_members.filter(
            is_active=True
        ).count(),
        'inactive_staff': staff_members.filter(
            is_active=False
        ).count()
    }

    return render(
        request,
        'admin/staff_management.html',
        context
    )


# =====================================================
# ADMIN: VIEW WORKER TASKS AND ATTENDANCE
# =====================================================

@login_required
def admin_staff_details(request, staff_id):

    if request.user.role != 'ADMIN':

        return HttpResponseForbidden(
            'Administrator access required.'
        )

    staff_member = get_object_or_404(
        User,
        pk=staff_id,
        role='STAFF'
    )

    tasks = TaskAssignment.objects.filter(
        staff_member=staff_member
    ).select_related(
        'complaint',
        'assigned_by'
    ).order_by('-assigned_at')

    attendance_records = StaffAttendance.objects.filter(
        staff_member=staff_member
    ).order_by('-attendance_date')[:30]

    context = {
        'staff_member': staff_member,
        'tasks': tasks,
        'attendance_records': attendance_records,
        'total_tasks': tasks.count(),
        'completed_tasks': tasks.filter(
            status='COMPLETED'
        ).count(),
        'in_progress_tasks': tasks.filter(
            status='IN_PROGRESS'
        ).count()
    }

    return render(
        request,
        'admin/staff_details.html',
        context
    )


# =====================================================
# ADMIN: EDIT WORKER DETAILS
# =====================================================

@login_required
def admin_edit_staff(request, staff_id):

    if request.user.role != 'ADMIN':

        return HttpResponseForbidden(
            'Administrator access required.'
        )

    staff_member = get_object_or_404(
        User,
        pk=staff_id,
        role='STAFF'
    )

    if request.method == 'POST':

        form = StaffUpdateForm(
            request.POST,
            instance=staff_member
        )

        if form.is_valid():

            form.save()

            messages.success(
                request,
                f'Details for {staff_member.username} were updated.'
            )

            return redirect('admin_staff_management')

    else:

        form = StaffUpdateForm(
            instance=staff_member
        )

    return render(
        request,
        'admin/edit_staff.html',
        {
            'form': form,
            'staff_member': staff_member
        }
    )


# =====================================================
# ADMIN: RESET WORKER PASSWORD
# =====================================================

@login_required
def admin_reset_staff_password(request, staff_id):

    if request.user.role != 'ADMIN':

        return HttpResponseForbidden(
            'Administrator access required.'
        )

    staff_member = get_object_or_404(
        User,
        pk=staff_id,
        role='STAFF'
    )

    if request.method == 'POST':

        form = SetPasswordForm(
            staff_member,
            request.POST
        )

        if form.is_valid():

            form.save()

            messages.success(
                request,
                f'Password reset successfully for '
                f'{staff_member.username}.'
            )

            return redirect('admin_staff_management')

    else:

        form = SetPasswordForm(
            staff_member
        )

    return render(
        request,
        'admin/reset_staff_password.html',
        {
            'form': form,
            'staff_member': staff_member
        }
    )


# =====================================================
# ADMIN: ACTIVATE / DEACTIVATE WORKER
# =====================================================

@login_required
@require_POST
def admin_toggle_staff_status(request, staff_id):

    if request.user.role != 'ADMIN':

        return HttpResponseForbidden(
            'Administrator access required.'
        )

    staff_member = get_object_or_404(
        User,
        pk=staff_id,
        role='STAFF'
    )

    staff_member.is_active = not staff_member.is_active

    staff_member.save(
        update_fields=['is_active']
    )

    if staff_member.is_active:

        messages.success(
            request,
            f'{staff_member.username} account has been activated.'
        )

    else:

        messages.warning(
            request,
            f'{staff_member.username} account has been deactivated. '
            'Their task and attendance history has been preserved.'
        )

    return redirect('admin_staff_management')
