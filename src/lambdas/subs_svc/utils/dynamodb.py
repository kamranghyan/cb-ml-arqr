"""
utils.dynamodb
===============
DynamoDB utility functions and helpers.

Purpose
-------
• Provide consistent DynamoDB client configuration
• Handle serialization/deserialization of dates
• Provide pagination helpers

Functions
---------
• get_dynamodb_resource() - Returns boto3 DynamoDB resource
• serialize_datetime() - Convert datetime to ISO string
• deserialize_datetime() - Convert ISO string to datetime
• paginate_query() - Handle paginated DynamoDB queries

Usage
-----
from utils.dynamodb import get_dynamodb_resource
db = get_dynamodb_resource()
table = db.Table('MyTable')

Notes
-----
• Uses botocore config with retries and timeouts
• All date fields stored as ISO 8601 strings
"""

import boto3
from botocore.config import Config
from typing import Optional, List, Dict, Any
from datetime import datetime
from functools import lru_cache


# Retry configuration
DYNAMODB_CONFIG = Config(
    retries={
        'max_attempts': 3,
        'mode': 'standard'
    },
    connect_timeout=5,
    read_timeout=10
)


@lru_cache(maxsize=1)
def get_dynamodb_resource():
    """
    Get DynamoDB resource with retry configuration.
    
    Returns:
        boto3.resource: DynamoDB resource
    """
    return boto3.resource('dynamodb', config=DYNAMODB_CONFIG)


def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
    """
    Convert datetime to ISO string for DynamoDB storage.
    
    Args:
        dt: datetime object or None
    
    Returns:
        str: ISO formatted datetime string or None
    """
    if dt is None:
        return None
    return dt.isoformat()


def deserialize_datetime(iso_str: Optional[str]) -> Optional[datetime]:
    """
    Convert ISO string from DynamoDB to datetime.
    
    Args:
        iso_str: ISO formatted datetime string or None
    
    Returns:
        datetime: datetime object or None
    """
    if iso_str is None:
        return None
    return datetime.fromisoformat(iso_str)


def paginate_query(table, **kwargs) -> List[Dict[str, Any]]:
    """
    Handle paginated DynamoDB queries.
    
    Args:
        table: DynamoDB table object
        **kwargs: Query parameters
    
    Returns:
        List[Dict]: All items from paginated query
    """
    items = []
    response = table.query(**kwargs)
    items.extend(response.get('Items', []))
    
    while 'LastEvaluatedKey' in response:
        kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        response = table.query(**kwargs)
        items.extend(response.get('Items', []))
    
    return items


def paginate_scan(table, **kwargs) -> List[Dict[str, Any]]:
    """
    Handle paginated DynamoDB scans.
    
    Args:
        table: DynamoDB table object
        **kwargs: Scan parameters
    
    Returns:
        List[Dict]: All items from paginated scan
    """
    items = []
    response = table.scan(**kwargs)
    items.extend(response.get('Items', []))
    
    while 'LastEvaluatedKey' in response:
        kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        response = table.scan(**kwargs)
        items.extend(response.get('Items', []))
    
    return items