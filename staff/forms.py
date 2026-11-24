
from django import forms

from .models import TaskAssignment
from accounts.models import User


class TaskAssignmentForm(forms.ModelForm):

    ASSIGNMENT_CHOICES = [
        ('AUTO', 'Automatic - Select the best available worker'),
        ('MANUAL', 'Manual - Choose a cleaning staff member'),
    ]

    assignment_mode = forms.ChoiceField(
        choices=ASSIGNMENT_CHOICES,
        initial='AUTO',
        widget=forms.Select(attrs={
            'class': 'form-select',
            'id': 'assignment_mode'
        })
    )

    staff_member = forms.ModelChoiceField(
        queryset=User.objects.filter(
            role='STAFF',
            is_active=True
        ).order_by('username'),
        required=False,
        empty_label='Select Cleaning Staff',
        widget=forms.Select(attrs={
            'class': 'form-select',
            'id': 'staff_member'
        })
    )

    class Meta:
        model = TaskAssignment
        fields = ['staff_member']

    def clean(self):
        cleaned_data = super().clean()

        mode = cleaned_data.get('assignment_mode')
        staff_member = cleaned_data.get('staff_member')

        if mode == 'MANUAL' and not staff_member:
            self.add_error(
                'staff_member',
                'Please select a cleaning staff member for manual assignment.'
            )

        return cleaned_data
