
import logging

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.db import transaction, IntegrityError
from django.views.decorators.http import require_POST
from django.utils import timezone

from PIL import Image, UnidentifiedImageError

from .models import Complaint, ComplaintImage, Feedback, DuplicateMatch
from .forms import ComplaintForm
from .ai_detection import find_potential_duplicates

from accounts.models import User
from staff.models import TaskAssignment
from notifications.utils import send_notification


logger = logging.getLogger(__name__)


# =====================================================
# SHARED IMAGE AND LOCATION VALIDATION
# =====================================================

def validate_complaint_upload(images, latitude, longitude):

    errors = []

    try:
        lat = float(latitude)
        lng = float(longitude)

        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValueError

    except (ValueError, TypeError):
        lat = None
        lng = None
        errors.append('Please select a valid location on the map.')

    if len(images) > 3:
        errors.append('Maximum 3 photographs allowed.')

    for image in images:

        if image.size > 5 * 1024 * 1024:
            errors.append('Each photograph must be under 5 MB.')
            break

        try:
            image.seek(0)

            with Image.open(image) as img:
                image_format = img.format
                img.verify()

            image.seek(0)

            if image_format not in ('JPEG', 'PNG', 'WEBP'):
                raise ValueError

        except (
            UnidentifiedImageError,
            OSError,
            ValueError
        ):
            errors.append(
                'Only valid JPEG, PNG and WebP images are allowed.'
            )
            break

        finally:
            image.seek(0)

    return lat, lng, errors


# =====================================================
# AI DUPLICATE CHECK - AJAX ENDPOINT
# =====================================================

@login_required
@require_POST
def check_duplicate_images(request):

    if request.user.role not in ['STUDENT', 'FACULTY']:
        return HttpResponseForbidden('Access denied.')

    category = request.POST.get('category', '')
    images = request.FILES.getlist('images')

    if category != 'GARBAGE' or not images:
        return JsonResponse({
            'success': True,
            'matches': [],
            'blocked': False,
            'requires_review': False
        })

    latitude = request.POST.get('latitude', '')
    longitude = request.POST.get('longitude', '')

    lat, lng, errors = validate_complaint_upload(
        images,
        latitude,
        longitude
    )

    if errors:
        return JsonResponse({
            'success': False,
            'errors': errors
        }, status=400)

    try:
        potential_matches = find_potential_duplicates(
            images,
            lat,
            lng
        )

        results = []

        for item in potential_matches[:5]:

            complaint = item['complaint']

            results.append({
                'complaint_id': complaint.id,
                'location': complaint.location,
                'category': complaint.get_category_display(),
                'created_at': timezone.localtime(
                    complaint.created_at
                ).strftime('%d %b %Y, %I:%M %p'),
                'similarity': round(
                    float(item['similarity']) * 100, 1
                ),
                'distance': item['distance']
            })

        # Potential matches do not block submission.
        # They are sent to the administrator for review.
        return JsonResponse({
            'success': True,
            'matches': results,
            'blocked': False,
            'requires_review': bool(potential_matches)
        })

    except Exception:
        logger.exception('AI duplicate pre-check failed.')

        return JsonResponse({
            'success': False,
            'errors': [
                'The AI duplicate check is unavailable. '
                'Please try again.'
            ]
        }, status=503)


# =====================================================
# SUBMIT COMPLAINT
# =====================================================

@login_required
def submit_complaint(request):

    if request.user.role not in ['STUDENT', 'FACULTY']:
        return HttpResponseForbidden('Access denied.')

    if request.method == 'POST':

        form = ComplaintForm(request.POST)
        images = request.FILES.getlist('images')

        latitude = request.POST.get('latitude', '')
        longitude = request.POST.get('longitude', '')

        if form.is_valid():

            lat, lng, validation_errors = validate_complaint_upload(
                images,
                latitude,
                longitude
            )

            for error in validation_errors:
                form.add_error(None, error)

            if not form.errors:

                potential_matches = []

                # Run AI duplicate detection only for garbage complaints.
                if (
                    form.cleaned_data.get('category') == 'GARBAGE'
                    and images
                ):
                    try:
                        potential_matches = find_potential_duplicates(
                            images,
                            lat,
                            lng
                        )

                    except Exception:
                        logger.exception(
                            'AI duplicate detection failed.'
                        )

                        form.add_error(
                            None,
                            'AI duplicate verification is temporarily '
                            'unavailable. Please try submitting again.'
                        )

                if not form.errors:

                    # Any potential match requires administrator review.
                    requires_admin_review = bool(potential_matches)

                    with transaction.atomic():

                        complaint = form.save(commit=False)

                        complaint.reporter = request.user
                        complaint.latitude = lat
                        complaint.longitude = lng

                        if requires_admin_review:
                            complaint.status = 'UNDER_REVIEW'

                        complaint.save()

                        # Save uploaded images.
                        for image in images:

                            image.seek(0)

                            ComplaintImage.objects.create(
                                complaint=complaint,
                                image=image
                            )

                        # Create a database record for every potential match.
                        for item in potential_matches:

                            matched_complaint = item['complaint']

                            DuplicateMatch.objects.get_or_create(
                                source_complaint=complaint,
                                matched_complaint=matched_complaint,
                                defaults={
                                    'similarity_score': float(
                                        item['similarity']
                                    ),
                                    'distance_meters': float(
                                        item['distance']
                                    ),
                                    'status': 'PENDING'
                                }
                            )

                        # Get all administrator accounts.
                        admin_users = list(
                            User.objects.filter(role='ADMIN')
                        )

                        if requires_admin_review:

                            notification_message = (
                                f'Complaint #{complaint.id} requires '
                                f'duplicate review. AI found '
                                f'{len(potential_matches)} potential match(es).'
                            )

                            notification_url = (
                                '/complaints/admin/duplicate-reviews/'
                            )

                        else:

                            notification_message = (
                                f'New complaint #{complaint.id} submitted '
                                f'by {complaint.reporter.username}.'
                            )

                            notification_url = '/admin/dashboard/'

                        # Notify administrators after the transaction commits.
                        def notify_admins():

                            for admin in admin_users:

                                send_notification(
                                    admin,
                                    notification_message,
                                    notification_url
                                )

                        transaction.on_commit(notify_admins)

                    if requires_admin_review:

                        messages.warning(
                            request,
                            f'Complaint #{complaint.id} submitted successfully. '
                            f'AI found potential duplicates. Your complaint '
                            f'has been sent to the administrator for review.'
                        )

                    else:

                        messages.success(
                            request,
                            f'Complaint #{complaint.id} submitted successfully!'
                        )

                    return redirect('my_complaints')

    else:
        form = ComplaintForm()

    return render(
        request,
        'complaints/submit.html',
        {'form': form}
    )


# =====================================================
# MY COMPLAINTS
# =====================================================

@login_required
def my_complaints(request):

    if request.user.role not in ['STUDENT', 'FACULTY']:
        return HttpResponseForbidden('Access denied.')

    complaints = Complaint.objects.filter(
        reporter=request.user
    ).prefetch_related('images').order_by('-created_at')

    for complaint in complaints:

        complaint.user_feedback = Feedback.objects.filter(
            complaint=complaint,
            reporter=request.user
        ).first()

    return render(
        request,
        'complaints/my_complaints.html',
        {'complaints': complaints}
    )


# =====================================================
# SUBMIT FEEDBACK
# =====================================================

@login_required
@require_POST
def submit_feedback(request, complaint_id):

    if request.user.role not in ['STUDENT', 'FACULTY']:
        return HttpResponseForbidden('Access denied.')

    complaint = get_object_or_404(
        Complaint,
        id=complaint_id,
        reporter=request.user
    )

    if complaint.status != 'COMPLETED':

        messages.error(
            request,
            'Feedback is available only after your complaint is completed.'
        )

        return redirect('my_complaints')

    if Feedback.objects.filter(complaint=complaint).exists():

        messages.warning(
            request,
            'You have already submitted feedback for this complaint.'
        )

        return redirect('my_complaints')

    try:

        rating = int(request.POST.get('rating', ''))

        if rating not in range(1, 6):
            raise ValueError

    except (ValueError, TypeError):

        messages.error(
            request,
            'Please select a valid rating between 1 and 5.'
        )

        return redirect('my_complaints')

    comment = request.POST.get('comment', '').strip()

    if len(comment) > 1000:

        messages.error(
            request,
            'Feedback comment cannot exceed 1000 characters.'
        )

        return redirect('my_complaints')

    assignment = (
        TaskAssignment.objects
        .filter(complaint=complaint)
        .order_by('-assigned_at')
        .first()
    )

    staff_member = assignment.staff_member if assignment else None

    try:

        with transaction.atomic():

            Feedback.objects.create(
                complaint=complaint,
                reporter=request.user,
                staff_member=staff_member,
                rating=rating,
                comment=comment
            )

    except IntegrityError:

        if Feedback.objects.filter(complaint=complaint).exists():

            messages.warning(
                request,
                'Feedback has already been submitted for this complaint.'
            )

            return redirect('my_complaints')

        raise

    admin_users = User.objects.filter(role='ADMIN')

    for admin in admin_users:

        send_notification(
            admin,
            f'New {rating}/5 feedback received for complaint #{complaint.id}.',
            '/admin/feedback/'
        )

    messages.success(
        request,
        'Thank you! Your feedback has been submitted successfully.'
    )

    return redirect('my_complaints')


# =====================================================
# ADMIN: VIEW PENDING COMPLAINTS
# =====================================================

@login_required
def admin_review_complaints(request):

    if request.user.role != 'ADMIN':
        return HttpResponseForbidden('Administrator access required.')

    complaints = (
        Complaint.objects
        .filter(status='UNDER_REVIEW')
        .select_related('reporter')
        .prefetch_related('images')
        .order_by('-created_at')
    )

    return render(
        request,
        'complaints/admin_review_complaints.html',
        {
            'complaints': complaints,
            'pending_count': complaints.count(),
        }
    )


# =====================================================
# ADMIN: REJECT A COMPLAINT
# =====================================================

@login_required
@require_POST
def reject_review_complaint(request, complaint_id):

    if request.user.role != 'ADMIN':
        return HttpResponseForbidden('Administrator access required.')

    with transaction.atomic():

        complaint = get_object_or_404(
            Complaint.objects.select_for_update(),
            id=complaint_id
        )

        if complaint.status != 'UNDER_REVIEW':

            messages.warning(
                request,
                'This complaint is no longer awaiting review.'
            )

            return redirect('admin_review_complaints')

        complaint.status = 'DUPLICATE'
        complaint.save(update_fields=['status'])

        transaction.on_commit(
            lambda: send_notification(
                complaint.reporter,
                f'Your complaint #{complaint.id} was rejected by the administrator.',
                '/my-complaints/'
            )
        )

    messages.success(
        request,
        f'Complaint #{complaint.id} has been rejected.'
    )

    return redirect('admin_review_complaints')


# =====================================================
# ADMIN: DUPLICATE IDENTIFICATION DASHBOARD
# =====================================================

@login_required
def admin_duplicate_reviews(request):

    if request.user.role != 'ADMIN':

        return HttpResponseForbidden(
            'Administrator access required.'
        )

    duplicate_matches = (
        DuplicateMatch.objects
        .select_related(
            'source_complaint',
            'source_complaint__reporter',
            'matched_complaint',
            'matched_complaint__reporter',
            'reviewed_by'
        )
        .prefetch_related(
            'source_complaint__images',
            'matched_complaint__images'
        )
        .order_by('-created_at')
    )

    pending_count = duplicate_matches.filter(
        status='PENDING'
    ).count()

    return render(
        request,
        'complaints/admin_duplicate_reviews.html',
        {
            'duplicate_matches': duplicate_matches,
            'pending_count': pending_count
        }
    )


# =====================================================
# ADMIN: ACCEPT OR REJECT DUPLICATE MATCH
# =====================================================

@login_required
@require_POST
def review_duplicate_match(request, match_id):

    if request.user.role != 'ADMIN':

        return HttpResponseForbidden(
            'Administrator access required.'
        )

    action = request.POST.get('action')

    if action not in ['confirm', 'reject']:

        messages.error(request, 'Invalid review action.')

        return redirect('admin_duplicate_reviews')

    with transaction.atomic():

        duplicate_match = get_object_or_404(
            DuplicateMatch.objects.select_for_update(),
            id=match_id
        )

        if duplicate_match.status != 'PENDING':

            messages.warning(
                request,
                'This match has already been reviewed.'
            )

            return redirect('admin_duplicate_reviews')

        # Lock the new complaint while updating its review status.
        source_complaint = get_object_or_404(
            Complaint.objects.select_for_update(),
            id=duplicate_match.source_complaint_id
        )

        if action == 'confirm':

            # Administrator confirms that this is a duplicate.
            duplicate_match.status = 'CONFIRMED'

            source_complaint.status = 'DUPLICATE'
            source_complaint.save(update_fields=['status'])

            notification_message = (
                f'Your complaint #{source_complaint.id} '
                'was confirmed as a duplicate.'
            )

            messages.success(
                request,
                f'Complaint #{source_complaint.id} marked as duplicate.'
            )

        else:

            # Administrator rejects this particular potential match.
            duplicate_match.status = 'REJECTED'

            # Check whether other potential matches are still pending.
            other_pending_matches = DuplicateMatch.objects.filter(
                source_complaint=source_complaint,
                status='PENDING'
            ).exclude(
                id=duplicate_match.id
            ).exists()

            # Check whether another match was already confirmed.
            confirmed_match_exists = DuplicateMatch.objects.filter(
                source_complaint=source_complaint,
                status='CONFIRMED'
            ).exclude(
                id=duplicate_match.id
            ).exists()

            # If no potential matches remain pending or confirmed,
            # return the complaint to normal processing.
            if not other_pending_matches and not confirmed_match_exists:

                source_complaint.status = 'SUBMITTED'

                source_complaint.save(
                    update_fields=['status']
                )

                notification_message = (
                    f'Your complaint #{source_complaint.id} was reviewed. '
                    'The suspected duplicate was rejected and your complaint '
                    'has been returned to normal processing.'
                )

                messages.success(
                    request,
                    'Duplicate match rejected. The complaint is now '
                    'available for normal processing.'
                )

            else:

                notification_message = (
                    f'The potential duplicate match for complaint '
                    f'#{source_complaint.id} was rejected. '
                    'Other potential matches are still awaiting review.'
                )

                messages.success(
                    request,
                    'Duplicate match rejected successfully.'
                )

        duplicate_match.reviewed_by = request.user
        duplicate_match.reviewed_at = timezone.now()

        duplicate_match.save(
            update_fields=[
                'status',
                'reviewed_by',
                'reviewed_at'
            ]
        )

        transaction.on_commit(
            lambda: send_notification(
                source_complaint.reporter,
                notification_message,
                '/my-complaints/'
            )
        )

    return redirect('admin_duplicate_reviews')
