
from django.urls import path
from . import views
from . import dashboard_views
from . import assignment_views

urlpatterns = [
    path('register/<str:role>/', views.register, name='register'),
    path('login/', views.user_login, name='login'),
    path('logout/', views.user_logout, name='logout'),

    path(
        'student/dashboard/',
        dashboard_views.student_dashboard,
        name='student_dashboard'
    ),
    path(
        'faculty/dashboard/',
        dashboard_views.faculty_dashboard,
        name='faculty_dashboard'
    ),
    path(
        'staff/dashboard/',
        dashboard_views.staff_dashboard,
        name='staff_dashboard'
    ),
    path(
        'admin/dashboard/',
        dashboard_views.admin_dashboard,
        name='admin_dashboard'
    ),

    path(
        'admin/staff/',
        views.admin_staff_management,
        name='admin_staff_management'
    ),
    path(
        'admin/staff/<int:staff_id>/',
        views.admin_staff_details,
        name='admin_staff_details'
    ),
    path(
        'admin/staff/<int:staff_id>/edit/',
        views.admin_edit_staff,
        name='admin_edit_staff'
    ),
    path(
        'admin/staff/<int:staff_id>/reset-password/',
        views.admin_reset_staff_password,
        name='admin_reset_staff_password'
    ),
    path(
        'admin/staff/<int:staff_id>/toggle-status/',
        views.admin_toggle_staff_status,
        name='admin_toggle_staff_status'
    ),

    path(
        'admin/feedback/',
        dashboard_views.admin_feedback,
        name='admin_feedback'
    ),

    path(
        'admin/assign/<int:complaint_id>/',
        assignment_views.assign_complaint,
        name='assign_complaint'
    ),

    path(
        'admin/assignment-monitor/',
        assignment_views.admin_assignment_monitor,
        name='admin_assignment_monitor'
    ),
]
