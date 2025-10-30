import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { findOrderByCarrierOrderId, updateOrderDispute } from '@/utils/order_processing';

interface UberEatsOrder {
  orderId: string;
  orderTag: string;
  workflowUuid: string;
  restaurant: {
    name: string;
    uuid: string;
  };
  eater: {
    name: string;
  };
  requestedAt: string;
  chargebackTotal: string | null;
}

interface UberEatsResponse {
  data: {
    ordersV2: {
      rows: UberEatsOrder[];
    };
  };
}

async function processOrders() {
  console.log('Starting order processing...\n');

  const dataDir = join(process.cwd(), 'data');
  const files = readdirSync(dataDir).filter(file => file.endsWith('.json'));

  console.log(`Found ${files.length} JSON files to process\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    console.log(`Processing file: ${file}`);
    const filepath = join(dataDir, file);
    const content = readFileSync(filepath, 'utf-8');
    const response: UberEatsResponse = JSON.parse(content);

    const orders = response.data?.ordersV2?.rows || [];
    console.log(`  Found ${orders.length} orders in file\n`);

    for (const order of orders) {
      try {
        console.log(`  Processing order ${order.orderId} (${order.restaurant.name})...`);

        // Parse order date
        let orderDate: Date | undefined;
        if (order.requestedAt) {
          try {
            orderDate = new Date(order.requestedAt);
          } catch (e) {
            console.log(`    ⚠️  Failed to parse order date: ${order.requestedAt}`);
          }
        }

        // Find order in database
        const dbOrder = await findOrderByCarrierOrderId(order.orderId, order.eater.name, orderDate);

        if (!dbOrder) {
          console.log(`    ⚠️  Order not found in database, skipping`);
          skipped++;
          continue;
        }

        // Determine if dispute was accepted
        const disputeAccepted = order.orderTag === 'DISPUTE_ACCEPTED';

        // Update the found order
        await updateOrderDispute(
          dbOrder.id,
          disputeAccepted,
          order.chargebackTotal || 0
        );

        console.log(`     ✓ Updated: disputed=true, dispute_accepted=${disputeAccepted}`);
        processed++;

      } catch (error) {
        console.error(`     ✗ Error processing order ${order.orderId}:`, error);
        errors++;
      }
    }

    console.log('');
  }

  console.log('\n=== Processing Summary ===');
  console.log(`Processed: ${processed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

processOrders().catch(console.error);
