#!/usr/bin/env python3
"""
scripts/migrate_tenants.py
===========================
One-time migration script to:
1. Remove 'planTier' field from existing tenants
2. Add subscription fields with default values
3. Handle existing planTier values (starter, pro, professional, enterprise, etc.)

This is a one-time script. Run it manually after deployment.

Usage:
    python scripts/migrate_tenants.py --dry-run      # Preview changes (safe)
    python scripts/migrate_tenants.py --execute      # Apply changes
    python scripts/migrate_tenants.py --execute --batch-size 50  # Batch processing
    python scripts/migrate_tenants.py --execute --tenant-id <uuid>  # Single tenant
"""

import boto3
import os
import sys
import json
import argparse
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ============================================
# CONFIGURATION
# ============================================

ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")
TABLE_NAME = os.getenv("TENANT_TABLE", f"TenantTable-{ENVIRONMENT}")
BACKUP_TABLE_NAME = f"{TABLE_NAME}-backup-{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

# Mapping for existing planTier values to default subscription state
# Adjust this based on your actual planTier values
PLAN_TIER_MAPPING = {
    "starter": {
        "status": "INACTIVE",
        "is_active": False,
        "mapped_plan": None
    },
    "pro": {
        "status": "INACTIVE", 
        "is_active": False,
        "mapped_plan": None
    },
    "professional": {
        "status": "INACTIVE",
        "is_active": False,
        "mapped_plan": None
    },
    "enterprise": {
        "status": "INACTIVE",
        "is_active": False,
        "mapped_plan": None
    },
    "premium": {
        "status": "INACTIVE",
        "is_active": False,
        "mapped_plan": None
    },
    "monthly": {
        "status": "INACTIVE",
        "is_active": False,
        "mapped_plan": "monthly"
    },
    "annual": {
        "status": "INACTIVE",
        "is_active": False,
        "mapped_plan": "annual"
    },
    "weekly": {
        "status": "INACTIVE",
        "is_active": False,
        "mapped_plan": "weekly"
    },
    "quarterly": {
        "status": "INACTIVE",
        "is_active": False,
        "mapped_plan": "quarterly"
    },
    "semi_annual": {
        "status": "INACTIVE",
        "is_active": False,
        "mapped_plan": "semi_annual"
    }
}

# Default values for tenants without planTier
DEFAULT_SUBSCRIPTION = {
    "status": "INACTIVE",
    "is_active": False,
    "plan_id": None
}

# ============================================
# MIGRATION CLASS
# ============================================

class TenantMigration:
    """Handles migration of tenant records from old to new schema"""
    
    def __init__(self, dry_run: bool = True, batch_size: int = 25):
        """
        Initialize migration.
        
        Args:
            dry_run: If True, preview changes without applying
            batch_size: Number of tenants to process in one batch
        """
        self.dry_run = dry_run
        self.batch_size = batch_size
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(TABLE_NAME)
        
        # Statistics
        self.stats = {
            'total': 0,
            'processed': 0,
            'migrated': 0,
            'already_migrated': 0,
            'failed': 0,
            'skipped': 0,
            'backup_created': False
        }
        
        # Backup items (for rollback)
        self.backup_items = []
    
    def get_all_tenants(self) -> List[Dict]:
        """Scan all tenants from the table with pagination"""
        items = []
        try:
            response = self.table.scan()
            items.extend(response.get('Items', []))
            
            # Handle pagination
            while 'LastEvaluatedKey' in response:
                response = self.table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
                items.extend(response.get('Items', []))
                
            logger.info(f"Found {len(items)} tenants in {TABLE_NAME}")
            return items
            
        except ClientError as e:
            logger.error(f"Failed to scan table {TABLE_NAME}: {str(e)}")
            raise
    
    def backup_tenant(self, tenant: Dict) -> bool:
        """Backup tenant to backup table for rollback"""
        if self.dry_run:
            return True
            
        try:
            # Create backup table if not exists
            if not self.stats['backup_created']:
                self._create_backup_table()
                self.stats['backup_created'] = True
            
            # Store tenant data in backup table
            backup_item = tenant.copy()
            backup_item['backupTimestamp'] = datetime.now(timezone.utc).isoformat()
            backup_item['backupReason'] = 'pre-migration'
            
            backup_table = self.dynamodb.Table(BACKUP_TABLE_NAME)
            backup_table.put_item(Item=backup_item)
            self.backup_items.append(tenant.get('tenantId'))
            return True
            
        except ClientError as e:
            logger.error(f"Failed to backup tenant {tenant.get('tenantId')}: {str(e)}")
            return False
    
    def _create_backup_table(self):
        """Create backup table with same schema as original"""
        if self.dry_run:
            return
            
        try:
            # Check if backup table exists
            existing_tables = self.dynamodb.meta.client.list_tables()
            if BACKUP_TABLE_NAME in existing_tables['TableNames']:
                logger.info(f"Backup table {BACKUP_TABLE_NAME} already exists")
                return
            
            # Get table schema from original
            original_table = self.dynamodb.meta.client.describe_table(TableName=TABLE_NAME)
            table_schema = original_table['Table']
            
            # Prepare create table params
            create_params = {
                'TableName': BACKUP_TABLE_NAME,
                'AttributeDefinitions': table_schema['AttributeDefinitions'],
                'KeySchema': table_schema['KeySchema'],
                'BillingMode': table_schema['BillingModeSummary']['BillingMode']
            }
            
            # Only add GSI if they exist
            if 'GlobalSecondaryIndexes' in table_schema and table_schema['GlobalSecondaryIndexes']:
                create_params['GlobalSecondaryIndexes'] = table_schema['GlobalSecondaryIndexes']
            
            # Create backup table
            self.dynamodb.create_table(**create_params)
            
            # Wait for table to be active
            waiter = self.dynamodb.meta.client.get_waiter('table_exists')
            waiter.wait(TableName=BACKUP_TABLE_NAME)
            
            logger.info(f"✅ Backup table {BACKUP_TABLE_NAME} created successfully")
            
        except ClientError as e:
            logger.error(f"Failed to create backup table: {str(e)}")
            raise
    
    def needs_migration(self, tenant: Dict) -> Tuple[bool, str]:
        """
        Check if tenant needs migration.
        
        Returns:
            Tuple[bool, str]: (needs_migration, reason)
        """
        tenant_id = tenant.get('tenantId')
        
        # Check if tenant has subscription fields
        has_subscription_status = 'subscriptionStatus' in tenant
        has_is_active = 'subscriptionIsActive' in tenant
        
        # Check if tenant has old planTier field
        has_plan_tier = 'planTier' in tenant
        
        if has_plan_tier and (has_subscription_status or has_is_active):
            return True, "Has old planTier and new subscription fields - needs cleanup"
        
        if has_plan_tier and not has_subscription_status:
            return True, "Has old planTier, needs subscription fields"
        
        if has_subscription_status and not has_is_active:
            return True, "Missing subscriptionIsActive field"
        
        if not has_plan_tier:
            return True, "Missing all subscription fields"
        
        return False, "Already migrated"
    
    def migrate_tenant(self, tenant: Dict) -> Dict:
        """
        Migrate a single tenant to new schema.
        
        Returns:
            Dict: Migration result
        """
        tenant_id = tenant.get('tenantId')
        
        if not tenant_id:
            return {'status': 'skipped', 'reason': 'No tenantId found'}
        
        try:
            # Check if migration is needed
            needs_migration, reason = self.needs_migration(tenant)
            if not needs_migration:
                self.stats['already_migrated'] += 1
                return {'status': 'skipped', 'reason': reason}
            
            # Get old planTier if exists
            old_plan_tier = tenant.get('planTier', None)
            
            # Determine subscription values
            if old_plan_tier and old_plan_tier in PLAN_TIER_MAPPING:
                mapping = PLAN_TIER_MAPPING[old_plan_tier]
                subscription_status = mapping['status']
                is_active = mapping['is_active']
                plan_id = mapping['mapped_plan']
            else:
                # Unknown planTier - set default
                subscription_status = DEFAULT_SUBSCRIPTION['status']
                is_active = DEFAULT_SUBSCRIPTION['is_active']
                plan_id = DEFAULT_SUBSCRIPTION['plan_id']
                if old_plan_tier:
                    logger.warning(f"Unknown planTier '{old_plan_tier}' for tenant {tenant_id} - using default")
            
            # Build update expression
            update_parts = []
            expression_attrs = {}
            expression_vals = {}
            
            # Add subscription fields
            update_parts.append("#subscriptionStatus = :status")
            expression_attrs["#subscriptionStatus"] = "subscriptionStatus"
            expression_vals[":status"] = subscription_status
            
            update_parts.append("#subscriptionIsActive = :is_active")
            expression_attrs["#subscriptionIsActive"] = "subscriptionIsActive"
            expression_vals[":is_active"] = is_active
            
            update_parts.append("#updatedAt = :updated_at")
            expression_attrs["#updatedAt"] = "updatedAt"
            expression_vals[":updated_at"] = datetime.now(timezone.utc).isoformat()
            
            # Add planId if mapping exists
            if plan_id:
                update_parts.append("#currentPlanId = :plan_id")
                expression_attrs["#currentPlanId"] = "currentPlanId"
                expression_vals[":plan_id"] = plan_id
            
            # Remove planTier field if it exists
            remove_parts = []
            if 'planTier' in tenant:
                remove_parts.append("#planTier")
                expression_attrs["#planTier"] = "planTier"
            
            # Construct full expression
            update_expression = "SET " + ", ".join(update_parts)
            if remove_parts:
                update_expression += " REMOVE " + ", ".join(remove_parts)
            
            if self.dry_run:
                # Just log what would happen
                logger.info(f"[DRY RUN] Would migrate tenant: {tenant_id}")
                logger.info(f"  - Old planTier: {old_plan_tier}")
                logger.info(f"  - New status: {subscription_status}")
                logger.info(f"  - New is_active: {is_active}")
                if plan_id:
                    logger.info(f"  - Mapped plan: {plan_id}")
                logger.info(f"  - Remove: {', '.join(remove_parts) if remove_parts else 'None'}")
                self.stats['migrated'] += 1
                return {'status': 'dry_run', 'tenant_id': tenant_id}
            
            # Actually execute the update
            self.table.update_item(
                Key={"tenantId": tenant_id},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expression_attrs,
                ExpressionAttributeValues=expression_vals
            )
            
            self.stats['migrated'] += 1
            logger.info(f"✅ Migrated tenant: {tenant_id} ({old_plan_tier} → {subscription_status})")
            
            return {
                'status': 'success',
                'tenant_id': tenant_id,
                'old_plan': old_plan_tier,
                'new_status': subscription_status
            }
            
        except ClientError as e:
            logger.error(f"❌ Failed to migrate tenant {tenant_id}: {str(e)}")
            self.stats['failed'] += 1
            return {'status': 'failed', 'tenant_id': tenant_id, 'error': str(e)}
        except Exception as e:
            logger.error(f"❌ Unexpected error for tenant {tenant_id}: {str(e)}")
            self.stats['failed'] += 1
            return {'status': 'failed', 'tenant_id': tenant_id, 'error': str(e)}
    
    def run(self, tenant_id: Optional[str] = None):
        """
        Run the migration.
        
        Args:
            tenant_id: Optional specific tenant ID to migrate (for testing)
        """
        logger.info("=" * 80)
        logger.info(f"Starting Tenant Migration")
        logger.info(f"  - Environment: {ENVIRONMENT}")
        logger.info(f"  - Table: {TABLE_NAME}")
        logger.info(f"  - Dry Run: {self.dry_run}")
        logger.info(f"  - Batch Size: {self.batch_size}")
        if tenant_id:
            logger.info(f"  - Target Tenant: {tenant_id}")
        logger.info("=" * 80)
        
        # Get tenants
        if tenant_id:
            # Migrate single tenant
            response = self.table.get_item(Key={"tenantId": tenant_id})
            tenants = [response.get('Item')] if response.get('Item') else []
            if not tenants:
                logger.error(f"Tenant {tenant_id} not found")
                return
        else:
            tenants = self.get_all_tenants()
        
        self.stats['total'] = len(tenants)
        logger.info(f"\nFound {len(tenants)} tenants to process\n")
        
        if not tenants:
            logger.info("No tenants found to migrate")
            return
        
        # Process in batches
        for i, tenant in enumerate(tenants, 1):
            # Backup before migration (if not dry run)
            if not self.dry_run:
                self.backup_tenant(tenant)
            
            # Migrate
            result = self.migrate_tenant(tenant)
            self.stats['processed'] = i
            
            # Log progress
            if i % 10 == 0 or i == len(tenants):
                logger.info(f"Progress: {i}/{len(tenants)} tenants processed")
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print migration summary"""
        logger.info("\n" + "=" * 80)
        logger.info("MIGRATION SUMMARY")
        logger.info("=" * 80)
        logger.info(f"  📊 Total tenants scanned: {self.stats['total']}")
        logger.info(f"  ✅ Migrated: {self.stats['migrated']}")
        logger.info(f"  ⏭️  Already migrated: {self.stats['already_migrated']}")
        logger.info(f"  ❌ Failed: {self.stats['failed']}")
        logger.info(f"  ⏭️  Skipped: {self.stats['skipped']}")
        
        if self.stats['backup_created']:
            logger.info(f"  💾 Backup table: {BACKUP_TABLE_NAME}")
            logger.info(f"  📝 Backed up {len(self.backup_items)} tenants")
        
        if self.dry_run:
            logger.info("\n⚠️  This was a DRY RUN. No changes were made.")
            logger.info("  To apply changes, run: python scripts/migrate_tenants.py --execute")
        else:
            logger.info("\n✅ Migration completed successfully!")
            logger.info(f"  To rollback, restore from backup table: {BACKUP_TABLE_NAME}")
        
        logger.info("=" * 80)
    
    def rollback(self, tenant_id: Optional[str] = None):
        """Rollback migration from backup"""
        logger.warning("⚠️  ROLLBACK OPERATION")
        logger.warning("This will restore tenants from backup table")
        
        if not self.stats['backup_created']:
            logger.error("No backup found. Cannot rollback.")
            return
        
        backup_table = self.dynamodb.Table(BACKUP_TABLE_NAME)
        
        if tenant_id:
            response = backup_table.get_item(Key={"tenantId": tenant_id})
            backup_item = response.get('Item')
            if backup_item:
                # Remove backup-specific fields
                backup_item.pop('backupTimestamp', None)
                backup_item.pop('backupReason', None)
                # Restore to original table
                self.table.put_item(Item=backup_item)
                logger.info(f"✅ Restored tenant {tenant_id} from backup")
            else:
                logger.error(f"Tenant {tenant_id} not found in backup")
        else:
            # Restore all tenants
            response = backup_table.scan()
            items = response.get('Items', [])
            
            for item in items:
                # Remove backup-specific fields
                item.pop('backupTimestamp', None)
                item.pop('backupReason', None)
                self.table.put_item(Item=item)
            
            logger.info(f"✅ Restored {len(items)} tenants from backup")


# ============================================
# MAIN ENTRY POINT
# ============================================

def main():
    """Main entry point for migration script"""
    parser = argparse.ArgumentParser(
        description="Migrate tenant data from old to new subscription schema"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        default=True,
        help="Preview changes without applying (default: True)"
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help="Actually execute migration (overrides --dry-run)"
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=25,
        help="Number of tenants to process in one batch (default: 25)"
    )
    parser.add_argument(
        '--tenant-id',
        type=str,
        help="Migrate a specific tenant ID only (for testing)"
    )
    parser.add_argument(
        '--rollback',
        action='store_true',
        help="Rollback migration from backup (WARNING: destructive)"
    )
    parser.add_argument(
        '--env',
        type=str,
        default="dev",
        help="Environment name (dev, staging, prod) (default: dev)"
    )
    
    args = parser.parse_args()
    
    # Set environment
    global ENVIRONMENT, TABLE_NAME
    ENVIRONMENT = args.env
    TABLE_NAME = f"TenantTable-{ENVIRONMENT}"
    
    # Determine dry run mode
    dry_run = True
    if args.execute:
        dry_run = False
    elif args.dry_run:
        dry_run = True
    
    # Handle rollback
    if args.rollback:
        migration = TenantMigration(dry_run=False)
        migration.rollback(args.tenant_id)
        return
    
    # Create migration instance
    migration = TenantMigration(
        dry_run=dry_run,
        batch_size=args.batch_size
    )
    
    # Run migration
    migration.run(tenant_id=args.tenant_id)


if __name__ == "__main__":
    main()