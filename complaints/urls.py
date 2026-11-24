
from django.urls import path
from . import views
from . import hotspot_views


urlpatterns = [
    path(
        'submit/',
        views.submit_complaint,
        name='submit_complaint'
    ),

    path(
        'check-duplicates/',
        views.check_duplicate_images,
        name='check_duplicate_images'
    ),

    path(
        'my-complaints/',
        views.my_complaints,
        name='my_complaints'
    ),

    path(
        'feedback/<int:complaint_id>/submit/',
        views.submit_feedback,
        name='submit_feedback'
    ),

    path(
        'admin/review-complaints/',
        views.admin_review_complaints,
        name='admin_review_complaints'
    ),

    path(
        'admin/review-complaints/<int:complaint_id>/reject/',
        views.reject_review_complaint,
        name='reject_review_complaint'
    ),

    path(
        'admin/duplicate-reviews/',
        views.admin_duplicate_reviews,
        name='admin_duplicate_reviews'
    ),

    path(
        'admin/duplicate-reviews/<int:match_id>/review/',
        views.review_duplicate_match,
        name='review_duplicate_match'
    ),

    # Smart cleanliness hotspot dashboard
    path(
        'admin/hotspots/',
        hotspot_views.admin_hotspot_dashboard,
        name='admin_hotspot_dashboard'
    ),
]
