from django.db import models

# Create your models here.

from django.db import models
from django.conf import settings
from complaints.models import Complaint


class TaskAssignment(models.Model):

    STATUS_CHOICES = [
        ('ASSIGNED', 'Assigned'),
        ('ACCEPTED', 'Accepted'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
    ]

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='assignments'
    )

    staff_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='assigned_tasks',
        limit_choices_to={'role': 'STAFF'}
    )

    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='tasks_assigned'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ASSIGNED'
    )

    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Task #{self.id} - Complaint #{self.complaint.id}"
class CompletionEvidence(models.Model):
    assignment = models.ForeignKey(
        TaskAssignment,
        on_delete=models.CASCADE,
        related_name='evidence'
    )
    image = models.ImageField(upload_to='completion_evidence/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Completion evidence for Task #{self.assignment.id}"
    
class StaffAttendance(models.Model):

    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('LATE', 'Late'),
        ('ABSENT', 'Absent'),
    ]

    staff_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_records',
        limit_choices_to={'role': 'STAFF'}
    )

    attendance_date = models.DateField()

    check_in = models.DateTimeField(
        null=True,
        blank=True
    )

    check_out = models.DateTimeField(
        null=True,
        blank=True
    )

    last_seen = models.DateTimeField(
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='ABSENT'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-attendance_date', '-check_in']
        constraints = [
            models.UniqueConstraint(
                fields=['staff_member', 'attendance_date'],
                name='unique_staff_daily_attendance'
            )
        ]

    def __str__(self):
        return (
            f'{self.staff_member.username} - '
            f'{self.attendance_date} - {self.status}'
        )

    @property
    def is_online(self):
        from django.utils import timezone
        from datetime import timedelta

        if not self.check_in or self.check_out:
            return False

        if not self.last_seen:
            return False

        return (
            timezone.now() - self.last_seen
        ) <= timedelta(minutes=2)

    @property
    def working_seconds(self):
        from django.utils import timezone

        if not self.check_in:
            return 0

        finish_time = self.check_out or timezone.now()

        return max(
            0,
            int((finish_time - self.check_in).total_seconds())
        )

    @property
    def working_hours_display(self):
        seconds = self.working_seconds
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60

        return f'{hours}h {minutes}m'
