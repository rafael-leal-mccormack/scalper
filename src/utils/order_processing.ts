import { supabase } from './supabase';

export async function findOrderByCarrierOrderId(orderId: string, orderDate?: Date) {
  let query = supabase
    .from('delivery_orders')
    .select('*')
    .ilike('carrier_order_id', `%${orderId}%`);

  // If orderDate is provided, add timeframe filter (±24 hours)
  if (orderDate) {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const startDate = new Date(orderDate.getTime() - oneDayMs).toISOString();
    const endDate = new Date(orderDate.getTime() + oneDayMs).toISOString();

    query = query
      .gte('created_at', startDate)
      .lte('created_at', endDate);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    throw error;
  }

  return data;
}

export async function updateOrderDispute(orderId: string, disputeAccepted: boolean, disputeAmount: string | number) {
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
    .ilike('carrier_order_id', `%${orderId}%`)
    .select();

  if (error) {
    throw error;
  }

  return data;
}
