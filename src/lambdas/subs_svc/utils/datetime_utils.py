"""
utils.datetime_utils
=====================
Date/time utility functions for subscription calculations.

Purpose
-------
• Calculate subscription expiration dates
• Determine days remaining in subscription
• Validate if subscription is currently active

Functions
---------
• calculate_end_date(start_date, duration_days) -> datetime
• get_days_remaining(end_date) -> int
• is_subscription_active(start_date, end_date) -> bool
• format_iso_datetime(dt) -> str

Usage
-----
end_date = calculate_end_date(now, 30)
days = get_days_remaining(end_date)
active = is_subscription_active(start_date, end_date)

Notes
-----
• All time calculations use UTC timezone
• Days remaining is ceiling (rounded up) for display
"""

from datetime import datetime, timedelta
from typing import Optional


def calculate_end_date(start_date: datetime, duration_days: int) -> datetime:
    """
    Calculate subscription end date based on start date and duration.
    
    Args:
        start_date: Subscription start date
        duration_days: Number of days the subscription is valid
    
    Returns:
        datetime: End date of subscription
    """
    return start_date + timedelta(days=duration_days)


def get_days_remaining(end_date: datetime) -> int:
    """
    Calculate days remaining until subscription expiration.
    
    Args:
        end_date: Subscription expiration date
    
    Returns:
        int: Days remaining (0 if expired or already passed)
    """
    now = datetime.utcnow()
    days = (end_date - now).days
    return max(0, days)


def is_subscription_active(start_date: datetime, end_date: datetime) -> bool:
    """
    Check if subscription is currently active.
    
    Args:
        start_date: Subscription start date
        end_date: Subscription expiration date
    
    Returns:
        bool: True if current time is between start and end dates
    """
    now = datetime.utcnow()
    return start_date <= now <= end_date


def format_iso_datetime(dt: Optional[datetime]) -> Optional[str]:
    """
    Format datetime to ISO string.
    
    Args:
        dt: datetime object or None
    
    Returns:
        str: ISO formatted datetime string or None
    """
    if dt is None:
        return None
    return dt.isoformat()