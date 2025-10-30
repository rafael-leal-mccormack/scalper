import { supabase } from './supabase';

export async function findOrderByCarrierOrderId(
  orderId: string, 
  eaterName: string,
  orderDate?: Date
) {
  let query = supabase
    .from('delivery_orders')
    .select('*')
    .or(`carrier_order_id.ilike.%${orderId}%,carrier_order_id.ilike.%${eaterName}%`);

  // If orderDate is provided, add timeframe filter (±48 hours)
  if (orderDate) {
    const twoDaysMs = 25 * 60 * 60 * 1000;
    const startDate = new Date(orderDate.getTime() - twoDaysMs).toISOString();
    const endDate = new Date(orderDate.getTime() + twoDaysMs).toISOString();

    query = query
      .gte('created_at', startDate)
      .lte('created_at', endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // If no results, return null
  if (!data || data.length === 0) {
    return null;
  }

  // If we got multiple results, find the one where carrier_order_id matches orderId
  if (data.length > 1) {
    console.log(`Found ${data.length} potential matches for orderId: ${orderId}, eaterName: ${eaterName}`);
    
    const exactMatch = data.find(order => 
      order.carrier_order_id?.toLowerCase().includes(orderId.toLowerCase())
    );
    
    if (exactMatch) {
      console.log(`Found exact carrier_order_id match: ${exactMatch.carrier_order_id}`);
      return exactMatch;
    }
    
    console.log(`No exact match found, using first result with carrier_order_id: ${data[0].carrier_order_id}`);
    return data[0];
  }

  // Single result, return it
  return data[0];
}

export async function updateOrderDispute(
  dbOrderId: number,
  disputeAccepted: boolean, 
  disputeAmount: string | number | null
) {
  // Parse the dispute amount if it's a formatted string like "$2.68"
  let numericAmount: number | null = null;

  if (disputeAmount) {
    if (typeof disputeAmount === 'string') {
      // Remove currency symbol and parse to float
      numericAmount = parseFloat(disputeAmount.replace(/[$,]/g, ''));
    } else {
      numericAmount = disputeAmount;
    }
  }

  const { data, error } = await supabase
    .from('delivery_orders')
    .update({
      disputed: true,
      dispute_accepted: disputeAccepted,
      dispute_amount: numericAmount
    })
    .eq('id', dbOrderId)
    .select();

  if (error) {
    throw error;
  }

  return data;
}

export async function insertOrdersBulk(orders: any[]) {
  if (!orders || orders.length === 0) {
    return { inserted: 0, errors: [] };
  }

  // Process in chunks to avoid very large inserts
  const chunkSize = 100;
  let totalInserted = 0;
  const errors: any[] = [];

  for (let i = 0; i < orders.length; i += chunkSize) {
    const chunk = orders.slice(i, i + chunkSize);
    
    try {
      const { data, error } = await supabase
        .from('delivery_orders')
        .insert(chunk)
        .select();

      if (error) {
        console.error(`Error inserting chunk ${i / chunkSize + 1}:`, error);
        errors.push({ chunk: i / chunkSize + 1, error });
      } else {
        totalInserted += data?.length || 0;
        console.log(`  ✓ Inserted ${data?.length || 0} orders (chunk ${i / chunkSize + 1})`);
      }
    } catch (error) {
      console.error(`Exception inserting chunk ${i / chunkSize + 1}:`, error);
      errors.push({ chunk: i / chunkSize + 1, error });
    }
  }

  return { inserted: totalInserted, errors };
}
