import type { Order, ShippingStats } from '../types'

/** Round to cents to group identical shipping costs reliably. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Compute shipping statistics from the actual data.
 *
 * The rate distribution is built dynamically from the distinct shipping-cost
 * values present in the orders — it is NOT tied to any predefined tier list, so
 * it adapts to every transporter/company (Colissimo, DPD, GEODIS, …).
 */
export function calculateStats(orders: Order[]): ShippingStats {
  const totalOrders = orders.length
  const freeShippingOrders = orders.filter(o => round2(o.shippingCost) === 0).length
  const paidShippingOrders = totalOrders - freeShippingOrders

  const totalShippingCost = orders.reduce((sum, o) => sum + o.shippingCost, 0)
  const totalOrderValue = orders.reduce((sum, o) => sum + o.totalTTC, 0)

  // Group orders by their real shipping cost
  const byRate = new Map<number, { count: number; subtotal: number }>()
  for (const order of orders) {
    const rate = round2(order.shippingCost)
    const entry = byRate.get(rate) || { count: 0, subtotal: 0 }
    entry.count += 1
    entry.subtotal += order.shippingCost
    byRate.set(rate, entry)
  }

  const distribution = Array.from(byRate.entries())
    .map(([rate, { count, subtotal }]) => ({
      rate,
      count,
      subtotal: round2(subtotal),
      percentage: totalOrders > 0 ? count / totalOrders : 0,
    }))
    .sort((a, b) => a.rate - b.rate)

  return {
    totalOrders,
    freeShippingOrders,
    paidShippingOrders,
    distribution,
    totalShippingCost,
    totalOrderValue,
  }
}
