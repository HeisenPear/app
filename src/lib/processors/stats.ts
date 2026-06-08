import type { Order, ShippingStats } from '../types'
import { SHIPPING_RATES } from '../types'

export function calculateStats(orders: Order[]): ShippingStats {
  const totalOrders = orders.length
  const freeShippingOrders = orders.filter(o => o.shippingCost === 0).length
  const paidShippingOrders = totalOrders - freeShippingOrders

  const totalShippingCost = orders.reduce((sum, o) => sum + o.shippingCost, 0)
  const totalOrderValue = orders.reduce((sum, o) => sum + o.totalTTC, 0)

  // Build distribution for known rate tiers
  // Also handle unknown rates by rounding to nearest tier
  const distribution = SHIPPING_RATES.map(rate => {
    const matchingOrders = orders.filter(o => {
      const cost = Math.round(o.shippingCost * 100) / 100
      return Math.abs(cost - rate) < 0.01
    })
    const count = matchingOrders.length
    const subtotal = matchingOrders.reduce((sum, o) => sum + o.shippingCost, 0)
    const percentage = totalOrders > 0 ? count / totalOrders : 0
    return { rate, count, subtotal, percentage }
  })

  // Handle any orders that don't match known tiers — add to closest tier
  const unmatched = orders.filter(o => {
    const cost = Math.round(o.shippingCost * 100) / 100
    return !SHIPPING_RATES.some(r => Math.abs(cost - r) < 0.01)
  })

  if (unmatched.length > 0) {
    // Add unmatched to a "other" tier at end if needed, or just fold into distribution
    // For now, we add them as extra entries but typically try to match closest
    for (const order of unmatched) {
      const closest = SHIPPING_RATES.reduce((prev, curr) =>
        Math.abs(curr - order.shippingCost) < Math.abs(prev - order.shippingCost) ? curr : prev
      )
      const entry = distribution.find(d => d.rate === closest)
      if (entry) {
        entry.count += 1
        entry.subtotal += order.shippingCost
        entry.percentage = totalOrders > 0 ? entry.count / totalOrders : 0
      }
    }
  }

  return {
    totalOrders,
    freeShippingOrders,
    paidShippingOrders,
    distribution,
    totalShippingCost,
    totalOrderValue,
  }
}
