
# complaints/hotspot_views.py

from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden

from .hotspot_engine import build_hotspot_data


@login_required
def admin_hotspot_dashboard(request):

    if request.user.role != 'ADMIN':
        return HttpResponseForbidden(
            'Administrator access required.'
        )

    hotspots = build_hotspot_data()

    high_risk_count = sum(
        1 for item in hotspots
        if item['risk_level'] == 'HIGH'
    )

    medium_risk_count = sum(
        1 for item in hotspots
        if item['risk_level'] == 'MEDIUM'
    )

    low_risk_count = sum(
        1 for item in hotspots
        if item['risk_level'] == 'LOW'
    )

    total_complaints = sum(
        item['complaint_count']
        for item in hotspots
    )

    context = {
        'hotspots': hotspots,
        'total_hotspots': len(hotspots),
        'total_complaints': total_complaints,
        'high_risk_count': high_risk_count,
        'medium_risk_count': medium_risk_count,
        'low_risk_count': low_risk_count,
    }

    return render(
        request,
        'complaints/admin_hotspots.html',
        context
    )
