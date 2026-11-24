
from django.db import models
from django.conf import settings


class Complaint(models.Model):

    CATEGORY_CHOICES = [
        ('CLEANLINESS', 'Cleanliness'),
        ('GARBAGE', 'Garbage'),
        ('PLUMBING', 'Plumbing'),
        ('ELECTRICAL', 'Electrical'),
        ('MAINTENANCE', 'Maintenance'),
        ('OTHER', 'Other'),
    ]

    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    ]

    STATUS_CHOICES = [
        ('SUBMITTED', 'Submitted'),
        ('UNDER_REVIEW', 'Under Review'),
        ('ASSIGNED', 'Assigned'),
        ('ACCEPTED', 'Accepted'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('DUPLICATE', 'Duplicate'),
    ]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='complaints'
    )

    description = models.TextField()

    category = models.CharField(
        max_length=30,
        choices=CATEGORY_CHOICES
    )

    location = models.CharField(max_length=200)

    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default='MEDIUM'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='SUBMITTED'
    )

    latitude = models.FloatField()
    longitude = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Complaint #{self.id} - {self.category}"


class ComplaintImage(models.Model):

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='images'
    )

    image = models.ImageField(upload_to='complaints/')

    uploaded_at = models.DateTimeField(auto_now_add=True)
        # Perceptual image fingerprint
    image_hash = models.CharField(
        max_length=64,
        blank=True,
        default=''
    )

    # AI-generated visual feature vector
    visual_embedding = models.JSONField(
        default=list,
        blank=True
    )

    embedding_model = models.CharField(
        max_length=50,
        blank=True,
        default=''
    )

    def __str__(self):
        return f"Image for Complaint #{self.complaint.id}"


# =====================================================
# COMPLAINT FEEDBACK
# =====================================================

class Feedback(models.Model):

    RATING_CHOICES = [
        (1, '1 Star - Poor'),
        (2, '2 Stars - Fair'),
        (3, '3 Stars - Good'),
        (4, '4 Stars - Very Good'),
        (5, '5 Stars - Excellent'),
    ]

    complaint = models.OneToOneField(
        Complaint,
        on_delete=models.CASCADE,
        related_name='feedback'
    )

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='submitted_feedback'
    )

    staff_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_feedback',
        limit_choices_to={'role': 'STAFF'}
    )

    rating = models.PositiveSmallIntegerField(
        choices=RATING_CHOICES
    )

    comment = models.TextField(
        blank=True,
        max_length=1000
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return (
            f"Feedback for Complaint #{self.complaint_id} "
            f"- {self.rating}/5"
        )

class DuplicateMatch(models.Model):

    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('CONFIRMED', 'Confirmed Duplicate'),
        ('REJECTED', 'Not a Duplicate'),
    ]

    source_complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='potential_duplicates'
    )

    matched_complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='matched_by'
    )

    similarity_score = models.FloatField(default=0.0)
    distance_meters = models.FloatField(default=0.0)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    reviewed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='duplicate_reviews'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['source_complaint', 'matched_complaint'],
                name='unique_complaint_duplicate_match'
            )
        ]
        ordering = ['-created_at']

    def __str__(self):
        return (
            f"Complaint #{self.source_complaint_id} "
            f"may duplicate #{self.matched_complaint_id}"
        )
