import type { Order } from '../types'

/** Normalise an address signature for comparison (letters+digits only). */
function normAddr(a: string | undefined): string {
  return (a || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Deduplicate and normalize orders.
 *
 * Orders are keyed by company + transporter + order id. The same id appearing
 * twice normally means the same order (a re-import, or overlapping exports) and
 * is merged. BUT when the two records ship to DIFFERENT addresses, the id was
 * almost certainly mis-read by OCR on one of them — so they are kept as separate
 * orders instead of being wrongly collapsed into one.
 */
export function processOrders(orders: Order[]): Order[] {
  const orderMap = new Map<string, Order>()

  for (const order of orders) {
    const baseKey = `${order.company}:${order.transporter}:${order.id}`

    // If an order with this id already exists but ships elsewhere, treat the
    // incoming one as a distinct order under a disambiguated key.
    let key = baseKey
    const prior = orderMap.get(baseKey)
    if (
      prior &&
      normAddr(prior.shipAddress) &&
      normAddr(order.shipAddress) &&
      normAddr(prior.shipAddress) !== normAddr(order.shipAddress)
    ) {
      let n = 2
      while (orderMap.has(`${baseKey}#${n}`)) n++
      key = `${baseKey}#${n}`
    }

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
        shipAddress: existing.shipAddress || order.shipAddress,
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
