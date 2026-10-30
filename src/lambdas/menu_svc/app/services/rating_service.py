"""
app.services.rating_service
============================
Aggregates per-item ratings for a restaurant's menu.

Ratings themselves live on order_svc's OrderTable — a guest rates the whole
order, not an individual item. Until per-item rating exists, every item in a
rated order is credited with that order's rating. This service only reads
OrderTable (read-only IAM permissions — see template.yaml); it never writes
to it, since order_svc owns that data.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict

import boto3
from boto3.dynamodb.conditions import Attr

from app.core.config import get_settings
from shared.structured_logger import get_logger

log = get_logger("services.rating")


class RatingService:
    def __init__(self) -> None:
        settings = get_settings()
        self._table = boto3.resource("dynamodb").Table(settings.order_table)

    def get_item_ratings(
        self,
        restaurant_id: str,
    ) -> Dict[str, Dict[str, float]]:
        """
        Returns {itemId: {"averageRating": float, "maxRating": float,
        "ratingCount": int}} for every item that has appeared in at least
        one rated order for this restaurant.
        """
        sums: Dict[str, float] = defaultdict(float)
        counts: Dict[str, int] = defaultdict(int)
        maxes: Dict[str, float] = defaultdict(float)

        try:
            scan_kwargs = {
                "FilterExpression": (
                    Attr("restaurantId").eq(restaurant_id)
                    & Attr("rating").exists()
                ),
                "ProjectionExpression": "rating, lineItems",
            }

            while True:
                response = self._table.scan(**scan_kwargs)

                for order in response.get("Items", []):
                    rating = order.get("rating")
                    if rating is None:
                        continue

                    rating = float(rating)

                    for line_item in order.get("lineItems", []):
                        item_id = line_item.get("itemId")
                        if not item_id:
                            continue

                        sums[item_id] += rating
                        counts[item_id] += 1
                        maxes[item_id] = max(maxes[item_id], rating)

                last_key = response.get("LastEvaluatedKey")
                if not last_key:
                    break
                scan_kwargs["ExclusiveStartKey"] = last_key

        except Exception as exc:
            # Ratings are a nice-to-have on the menu view — never let a
            # ratings-table hiccup break the menu itself.
            log.warning(
                "rating.aggregation.failed",
                restaurant_id=restaurant_id,
                error=str(exc),
            )
            return {}

        return {
            item_id: {
                "averageRating": round(sums[item_id] / counts[item_id], 1),
                "maxRating": maxes[item_id],
                "ratingCount": counts[item_id],
            }
            for item_id in sums
        }