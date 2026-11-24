
import math
from datetime import timedelta
from functools import lru_cache

import imagehash
import torch
import torch.nn.functional as F

from PIL import Image, UnidentifiedImageError
from torchvision.models import resnet50, ResNet50_Weights
from django.utils import timezone

from .models import ComplaintImage


MODEL_NAME = "resnet50-imagenet-v1"

# Initial threshold. This needs testing against real campus images.
DUPLICATE_THRESHOLD = 0.75

# Compare reports within 200 metres.
MAX_DISTANCE_METERS = 200

# Compare only complaints from the previous 2 hours.
COMPARISON_WINDOW_HOURS = 2

# Complaints with these statuses are excluded.
EXCLUDED_STATUSES = ["COMPLETED", "DUPLICATE"]


@lru_cache(maxsize=1)
def get_feature_extractor():
    """Load ResNet50 once as a visual feature extractor."""

    weights = ResNet50_Weights.DEFAULT

    model = resnet50(weights=weights)
    model.fc = torch.nn.Identity()
    model.eval()

    return model, weights.transforms()


def open_uploaded_image(image_file):
    """Open an uploaded image or saved Django ImageField."""

    image_file.open("rb")

    try:
        with Image.open(image_file) as img:
            img.verify()

        image_file.seek(0)

        with Image.open(image_file) as img:
            return img.convert("RGB")

    except (UnidentifiedImageError, OSError):
        raise ValueError("Invalid image file.")

    finally:
        image_file.seek(0)


def generate_image_features(image_file):
    """Generate perceptual hash and normalized ResNet50 embedding."""

    image = open_uploaded_image(image_file)

    perceptual_hash = str(imagehash.phash(image))

    model, preprocess = get_feature_extractor()

    tensor = preprocess(image).unsqueeze(0)

    with torch.inference_mode():
        features = model(tensor)
        features = F.normalize(features, p=2, dim=1)

    embedding = features.squeeze(0).cpu().tolist()

    return perceptual_hash, embedding


def cosine_similarity(first, second):
    """Calculate cosine similarity between normalized embeddings."""

    if not first or not second:
        return 0.0

    if len(first) != len(second):
        return 0.0

    dot_product = sum(
        a * b for a, b in zip(first, second)
    )

    return max(0.0, min(1.0, dot_product))


def calculate_hash_similarity(first_hash, second_hash):
    """Compare perceptual hashes."""

    if not first_hash or not second_hash:
        return 0.0

    try:
        first = imagehash.hex_to_hash(first_hash)
        second = imagehash.hex_to_hash(second_hash)

        distance = first - second
        total_bits = len(first.hash.flatten())

        return 1.0 - (distance / total_bits)

    except (ValueError, TypeError):
        return 0.0


def calculate_distance_meters(lat1, lon1, lat2, lon2):
    """Calculate geographical distance using the Haversine formula."""

    earth_radius = 6371000

    lat1 = math.radians(lat1)
    lat2 = math.radians(lat2)

    difference_lat = math.radians(lat2 - lat1)
    difference_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(difference_lat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(difference_lon / 2) ** 2
    )

    return earth_radius * 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )


def get_saved_image_features(complaint_image):
    """Reuse saved features or generate them for older images."""

    if (
        complaint_image.image_hash
        and complaint_image.visual_embedding
        and complaint_image.embedding_model == MODEL_NAME
    ):
        return (
            complaint_image.image_hash,
            complaint_image.visual_embedding
        )

    image_hash, embedding = generate_image_features(
        complaint_image.image
    )

    complaint_image.image_hash = image_hash
    complaint_image.visual_embedding = embedding
    complaint_image.embedding_model = MODEL_NAME

    complaint_image.save(
        update_fields=[
            "image_hash",
            "visual_embedding",
            "embedding_model"
        ]
    )

    return image_hash, embedding


def get_recent_comparison_images(new_complaint=None):
    """
    Get images belonging to garbage complaints created
    within the previous 2 hours.

    Exclude:
    - The current complaint
    - Completed complaints
    - Duplicate complaints
    """

    cutoff_time = timezone.now() - timedelta(
        hours=COMPARISON_WINDOW_HOURS
    )

    existing_images = (
        ComplaintImage.objects
        .select_related("complaint")
        .filter(
            complaint__category="GARBAGE",
            complaint__created_at__gte=cutoff_time,
            complaint__created_at__lte=timezone.now()
        )
        .exclude(
            complaint__status__in=EXCLUDED_STATUSES
        )
    )

    if new_complaint is not None:
        existing_images = existing_images.exclude(
            complaint_id=new_complaint.id
        )

    return existing_images.order_by("-complaint__created_at")


def find_potential_duplicates(
    uploaded_images,
    latitude,
    longitude,
    new_complaint=None
):
    """
    Compare uploaded images against recent garbage complaints.

    Only complaints created within the previous 2 hours
    are considered.

    Completed and duplicate complaints are ignored.

    Candidates are returned even if their similarity is low.
    The submission view decides whether to block or submit.
    """

    candidates = {}

    existing_images = get_recent_comparison_images(
        new_complaint
    )

    for uploaded_image in uploaded_images:

        new_hash, new_embedding = generate_image_features(
            uploaded_image
        )

        for old_image in existing_images.iterator():

            old_complaint = old_image.complaint

            if (
                old_complaint.latitude is None
                or old_complaint.longitude is None
            ):
                continue

            distance = calculate_distance_meters(
                latitude,
                longitude,
                old_complaint.latitude,
                old_complaint.longitude
            )

            if distance > MAX_DISTANCE_METERS:
                continue

            old_hash, old_embedding = get_saved_image_features(
                old_image
            )

            visual_similarity = cosine_similarity(
                new_embedding,
                old_embedding
            )

            hash_similarity = calculate_hash_similarity(
                new_hash,
                old_hash
            )

            # Use the stronger of the two similarity signals.
            similarity = max(
                visual_similarity,
                hash_similarity
            )

            existing = candidates.get(old_complaint.id)

            if (
                existing is None
                or similarity > existing["similarity"]
            ):
                candidates[old_complaint.id] = {
                    "complaint": old_complaint,
                    "similarity": similarity,
                    "distance": round(distance, 1),
                }

    return sorted(
        candidates.values(),
        key=lambda item: item["similarity"],
        reverse=True
    )
