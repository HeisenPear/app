import type { Order } from '../types'

/**
 * Deduplicate and normalize orders.
 * If same order ID appears multiple times, keep the one with more data.
 */
export function processOrders(orders: Order[]): Order[] {
  const orderMap = new Map<string, Order>()

  for (const order of orders) {
    const key = `${order.company}:${order.transporter}:${order.id}`
    const existing = orderMap.get(key)

    if (!existing) {
      orderMap.set(key, order)
    } else {
      // Merge: prefer non-zero values
      const merged: Order = {
        ...existing,
        totalTTC: existing.totalTTC || order.totalTTC,
        shippingCost: existing.shippingCost !== 0 ? existing.shippingCost : order.shippingCost,
        date: existing.date || order.date,
        deliveryMode: existing.deliveryMode !== 'Standard' ? existing.deliveryMode : order.deliveryMode,
      }
      orderMap.set(key, merged)
    }
  }

  // Sort by date desc, then id
  return Array.from(orderMap.values()).sort((a, b) => {
    if (a.date && b.date) {
      return b.date.localeCompare(a.date)
    }
    return a.id.localeCompare(b.id)
  })
}
