import { supabase } from './supabase';

export async function findOrderByCarrierOrderId(orderId: string) {
  const { data, error } = await supabase
    .from('delivery_orders')
    .select('*')
    .ilike('carrier_order_id', `%${orderId}%`)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    throw error;
  }

  return data;
}

export async function updateOrderDispute(orderId: string, disputeAccepted: boolean) {
  const { data, error } = await supabase
    .from('delivery_orders')
    .update({
      disputed: true,
      dispute_accepted: disputeAccepted
    })
    .ilike('carrier_order_id', `%${orderId}%`)
    .select();

  if (error) {
    throw error;
  }

  return data;
}
