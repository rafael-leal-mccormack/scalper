# Project: Scalper

## Overview
Web scraping tool with modular project structure using Puppeteer for automated data collection and processing. The project integrates with Supabase for database operations and focuses on delivery platform order management.

## Architecture
- **Core**: `src/core/` - Reusable Puppeteer abstraction (Browser class)
- **Projects**: `src/projects/` - Individual scraping scripts organized by folder
  - `ubereats/` - UberEats merchant order scraping and dispute processing
  - `testing/` - Order processing utilities for batch operations
- **Utils**: `src/utils/` - Shared utilities
  - `supabase.ts` - Supabase client configuration
  - `order_processing.ts` - Database operations for order updates
  - `restaurants.ts` - Restaurant ID management

## Database Integration
- Uses Supabase with admin key for privileged operations
- Main table: `delivery_orders`
  - `carrier_order_id` - Order ID from delivery platform (searched with ILIKE)
  - `disputed` - Boolean flag for disputed orders
  - `dispute_accepted` - Boolean flag for accepted disputes

## Projects

### UberEats (`src/projects/ubereats/`)
Automated workflow for:
1. Login to UberEats Merchants portal (email verification flow)
2. Extract authentication cookies and CSRF tokens
3. Fetch orders via GraphQL API (7-day lookback window)
4. Filter for orders with issues (disputes, missing items, etc.)
5. Save orders to `data/` directory as timestamped JSON files
6. Process orders and update database dispute status
7. Map `orderTag === "DISPUTE_ACCEPTED"` to database fields

**Run**: `npm run ubereats`

### Testing (`src/projects/testing/`)
Batch processing for existing order JSON files:
- Reads all JSON files from `data/` directory
- Processes each order and updates database
- Provides processing summary (processed/skipped/errors)

**Run**: `npm run process-orders`

## Guidelines
- Keep core Browser class focused on common Puppeteer operations
- Each project gets its own folder under `src/projects/`
- Projects import and use the Browser core for consistency
- Use Supabase utilities for all database operations
- Order data saved to `data/` directory for backup and reprocessing
