import { supabase } from "./supabase";

export async function getUberEatsRestaurantIds() {
  const {data, error} = await supabase
    .from('restaurant_configurations')
    .select('uber_eats_restaurant_id, restaurant_id')
    .not('uber_eats_restaurant_id', 'is', null);

  if (error) {
    throw error;
  }

  return data.map((restaurant) => ({
    restaurantUUID: restaurant.uber_eats_restaurant_id,
    restaurantId: restaurant.restaurant_id
  }));
}

export async function getDoorDashRestaurantIds() {
  const {data, error} = await supabase
    .from('restaurant_configurations')
    .select('doordash_restaurant_id, restaurant_id, doordash_restaurant_email')
    .not('doordash_restaurant_id', 'is', null)
    .not('doordash_restaurant_email', 'is', null);

  if (error) {
    throw error;
  }

  return data.map((restaurant) => ({
    storeId: restaurant.doordash_restaurant_id,
    restaurantId: restaurant.restaurant_id,
    email: restaurant.doordash_restaurant_email
  }));
}