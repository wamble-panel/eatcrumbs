import { supabase } from '../config/supabase'

interface PointingSystem {
  points_per_unit: number
  minimum_spend: number
  redeem_value: number
  points_required_to_redeem: number
  expiry_days: number | null
}

export async function getPointingSystem(restaurantId: number): Promise<PointingSystem | null> {
  const { data } = await supabase
    .from('pointing_systems')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .single()
  return data
}

export function calculatePointsEarned(
  orderTotal: number,
  system: PointingSystem,
): number {
  if (orderTotal < system.minimum_spend) return 0
  return Math.floor(orderTotal * system.points_per_unit)
}

export function calculateRedeemDiscount(
  pointsToRedeem: number,
  system: PointingSystem,
): number {
  const units = Math.floor(pointsToRedeem / system.points_required_to_redeem)
  return units * system.redeem_value
}

export async function awardPoints(
  customerId: string,
  restaurantId: number,
  receiptId: string,
  points: number,
): Promise<void> {
  if (points <= 0) return

  await supabase.rpc('award_points', {
    p_customer_id: customerId,
    p_restaurant_id: restaurantId,
    p_receipt_id: receiptId,
    p_points: points,
  })
}

export async function redeemPoints(
  customerId: string,
  restaurantId: number,
  receiptId: string,
  points: number,
): Promise<void> {
  if (points <= 0) return

  await supabase.rpc('redeem_points', {
    p_customer_id: customerId,
    p_restaurant_id: restaurantId,
    p_receipt_id: receiptId,
    p_points: points,
  })
}
