
from django import forms
from .models import Complaint


class ComplaintForm(forms.ModelForm):

    class Meta:
        model = Complaint

        fields = [
            'description',
            'category',
            'location',
            'priority',
        ]

        widgets = {
            'description': forms.Textarea(
                attrs={
                    'class': 'form-control',
                    'rows': 4,
                    'placeholder': 'Describe the problem'
                }
            ),

            'category': forms.Select(
                attrs={'class': 'form-select'}
            ),

            'location': forms.TextInput(
                attrs={
                    'class': 'form-control',
                    'placeholder': 'Example: Near A Hostel'
                }
            ),

            'priority': forms.Select(
                attrs={'class': 'form-select'}
            ),
        }
