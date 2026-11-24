
# complaints/hotspot_engine.py

import math
from collections import Counter

from django.utils import timezone

from .models import Complaint
from .models import Complaint, DuplicateMatch


# Distance threshold for grouping nearby complaints.
HOTSPOT_RADIUS_METERS = 100

# Score thresholds.
HIGH_RISK_THRESHOLD = 70
MEDIUM_RISK_THRESHOLD = 40

PRIORITY_POINTS = {
    'LOW': 10,
    'MEDIUM': 20,
    'HIGH': 30,
}


def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS coordinates in metres."""

    earth_radius = 6371000

    lat1 = math.radians(lat1)
    lon1 = math.radians(lon1)
    lat2 = math.radians(lat2)
    lon2 = math.radians(lon2)

    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(delta_lon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return earth_radius * c

def get_valid_complaints():
    """
    Retrieve complaints with valid coordinates.

    Exclude only complaints explicitly confirmed as duplicates
    through the DuplicateMatch review workflow.
    """

    confirmed_duplicate_ids = DuplicateMatch.objects.filter(
        status='CONFIRMED'
    ).values_list(
        'source_complaint_id',
        flat=True
    )

    complaints = (
        Complaint.objects
        .exclude(id__in=confirmed_duplicate_ids)
        .select_related('reporter')
        .order_by('-created_at')
    )

    valid_complaints = []

    for complaint in complaints:
        try:
            latitude = float(complaint.latitude)
            longitude = float(complaint.longitude)

            if not (
                -90 <= latitude <= 90
                and -180 <= longitude <= 180
            ):
                continue

            valid_complaints.append(complaint)

        except (TypeError, ValueError):
            continue

    return valid_complaints


def group_complaints_into_hotspots(complaints):
    """
    Group complaints when they are within the configured
    radius of an existing hotspot's current centroid.

    This is a practical proximity-based clustering method,
    not a trained machine-learning model.
    """

    clusters = []

    for complaint in complaints:
        latitude = float(complaint.latitude)
        longitude = float(complaint.longitude)

        nearest_cluster = None
        nearest_distance = None

        for cluster in clusters:
            distance = calculate_distance(
                latitude,
                longitude,
                cluster['latitude'],
                cluster['longitude']
            )

            if distance <= HOTSPOT_RADIUS_METERS:
                if nearest_distance is None or distance < nearest_distance:
                    nearest_cluster = cluster
                    nearest_distance = distance

        if nearest_cluster is None:
            clusters.append({
                'complaints': [complaint],
                'latitude': latitude,
                'longitude': longitude,
            })
        else:
            nearest_cluster['complaints'].append(complaint)

            # Recalculate the cluster centroid.
            members = nearest_cluster['complaints']

            nearest_cluster['latitude'] = sum(
                float(item.latitude) for item in members
            ) / len(members)

            nearest_cluster['longitude'] = sum(
                float(item.longitude) for item in members
            ) / len(members)

    return clusters


def calculate_hotspot_score(complaints):
    """Calculate recurrence, severity and recent-activity scores."""

    now = timezone.now()

    complaint_count = len(complaints)

    # 1. Recurrence score: maximum 50.
    recurrence_score = min(50, complaint_count * 10)

    # 2. Severity score: average priority weight, maximum 30.
    severity_values = [
        PRIORITY_POINTS.get(item.priority, 10)
        for item in complaints
    ]

    severity_score = round(
        sum(severity_values) / len(severity_values),
        1
    ) if severity_values else 0

    # 3. Recent activity: complaints from the last 30 days.
    recent_complaints = [
        item for item in complaints
        if (now - item.created_at).days <= 30
    ]

    recent_score = min(
        20,
        len(recent_complaints) * 5
    )

    total_score = round(
        recurrence_score + severity_score + recent_score
    )

    if total_score >= HIGH_RISK_THRESHOLD:
        risk_level = 'HIGH'
    elif total_score >= MEDIUM_RISK_THRESHOLD:
        risk_level = 'MEDIUM'
    else:
        risk_level = 'LOW'

    return {
        'score': total_score,
        'risk_level': risk_level,
        'recurrence_score': recurrence_score,
        'severity_score': severity_score,
        'recent_score': recent_score,
        'recent_count': len(recent_complaints),
    }


def build_hotspot_data():
    """Build the hotspot records used by the admin dashboard."""

    complaints = get_valid_complaints()

    clusters = group_complaints_into_hotspots(complaints)

    hotspots = []

    for index, cluster in enumerate(clusters, start=1):
        members = cluster['complaints']

        score_data = calculate_hotspot_score(members)

        categories = Counter(
            item.get_category_display()
            for item in members
        )

        priorities = Counter(
            item.get_priority_display()
            for item in members
        )

        latest_complaint = max(
            members,
            key=lambda item: item.created_at
        )

        location_names = list(dict.fromkeys(
            item.location for item in members if item.location
        ))

        hotspots.append({
            'id': index,
            'latitude': round(cluster['latitude'], 7),
            'longitude': round(cluster['longitude'], 7),
            'complaint_count': len(members),
            'score': score_data['score'],
            'risk_level': score_data['risk_level'],
            'recurrence_score': score_data['recurrence_score'],
            'severity_score': score_data['severity_score'],
            'recent_score': score_data['recent_score'],
            'recent_count': score_data['recent_count'],
            'categories': dict(categories),
            'priorities': dict(priorities),
            'location': location_names[0] if location_names else 'Campus location',
            'locations': location_names,
            'latest_date': timezone.localtime(
                latest_complaint.created_at
            ).strftime('%d %b %Y, %I:%M %p'),
            'complaint_ids': [item.id for item in members],
        })

    hotspots.sort(
        key=lambda item: item['score'],
        reverse=True
    )

    return hotspots
