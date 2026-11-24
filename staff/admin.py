
from django.contrib import admin
from .models import TaskAssignment, StaffAttendance


@admin.register(TaskAssignment)
class TaskAssignmentAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'complaint',
        'staff_member',
        'status',
        'assigned_at',
    )

    list_filter = ('status',)

    search_fields = (
        'staff_member__username',
        'complaint__location',
    )


@admin.register(StaffAttendance)
class StaffAttendanceAdmin(admin.ModelAdmin):

    list_display = (
        'staff_member',
        'attendance_date',
        'check_in',
        'check_out',
        'status',
        'last_seen',
    )

    list_filter = (
        'status',
        'attendance_date',
    )

    search_fields = (
        'staff_member__username',
    )

    readonly_fields = (
        'created_at',
    )

    ordering = (
        '-attendance_date',
        'staff_member__username',
    )
