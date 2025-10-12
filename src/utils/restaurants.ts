import { supabase } from "./supabase";

export async function getRestaurantIds() {
  const {data, error} = await supabase.from('restaurant_configurations').select('uber_eats_restaurant_id').not('uber_eats_restaurant_id', 'is', null);

  if (error) {
    throw error;
  }

  return data.map((restaurant) => restaurant.uber_eats_restaurant_id);
}