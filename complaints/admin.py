
from django.contrib import admin
from .models import Complaint, ComplaintImage, Feedback


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'reporter',
        'category',
        'location',
        'priority',
        'status',
        'created_at',
    )

    list_filter = ('category', 'priority', 'status')

    search_fields = (
        'reporter__username',
        'location',
        'description',
    )


@admin.register(ComplaintImage)
class ComplaintImageAdmin(admin.ModelAdmin):

    list_display = (
        'complaint',
        'uploaded_at',
    )


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):

    list_display = (
        'complaint',
        'reporter',
        'staff_member',
        'rating',
        'created_at',
    )

    list_filter = ('rating', 'created_at')

    search_fields = (
        'reporter__username',
        'staff_member__username',
        'comment',
    )

    readonly_fields = ('created_at',)

    ordering = ('-created_at',)
