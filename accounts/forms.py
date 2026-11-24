
from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User


class RegistrationForm(UserCreationForm):

    email = forms.EmailField(required=True)
    first_name = forms.CharField(max_length=50)
    last_name = forms.CharField(max_length=50)
    department = forms.CharField(max_length=100)
    phone = forms.CharField(max_length=15)

    class Meta:
        model = User
        fields = [
            'username',
            'first_name',
            'last_name',
            'email',
            'department',
            'phone',
            'password1',
            'password2'
        ]


class StaffCreationForm(UserCreationForm):

    first_name = forms.CharField(
        max_length=50,
        required=True,
        label='First name'
    )

    last_name = forms.CharField(
        max_length=50,
        required=True,
        label='Last name'
    )

    email = forms.EmailField(
        required=True,
        label='Email address'
    )

    phone = forms.CharField(
        max_length=15,
        required=True,
        label='Phone number'
    )

    department = forms.CharField(
        max_length=100,
        required=False,
        label='Department'
    )

    class Meta:
        model = User
        fields = [
            'username',
            'first_name',
            'last_name',
            'email',
            'phone',
            'department',
            'password1',
            'password2'
        ]

    def clean_email(self):
        email = self.cleaned_data['email'].strip()

        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError(
                'An account with this email address already exists.'
            )

        return email


class StaffUpdateForm(forms.ModelForm):

    class Meta:
        model = User

        fields = [
            'first_name',
            'last_name',
            'email',
            'phone',
            'department'
        ]

        widgets = {
            'first_name': forms.TextInput(
                attrs={'class': 'form-control'}
            ),
            'last_name': forms.TextInput(
                attrs={'class': 'form-control'}
            ),
            'email': forms.EmailInput(
                attrs={'class': 'form-control'}
            ),
            'phone': forms.TextInput(
                attrs={'class': 'form-control'}
            ),
            'department': forms.TextInput(
                attrs={'class': 'form-control'}
            )
        }

    def clean_email(self):
        email = self.cleaned_data['email'].strip()

        duplicate = User.objects.filter(
            email__iexact=email
        ).exclude(
            pk=self.instance.pk
        )

        if duplicate.exists():
            raise forms.ValidationError(
                'Another account already uses this email address.'
            )

        return email
