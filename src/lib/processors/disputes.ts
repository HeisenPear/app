import type { Order, Dispute } from '../types'

/**
 * Process disputes and link them to orders where possible.
 */
export function processDisputes(disputes: Dispute[], orders: Order[]): Dispute[] {
  // Build order lookup by ID
  const orderById = new Map<string, Order>()
  for (const order of orders) {
    orderById.set(order.id, order)
    // Also store by company:transporter:id
    orderById.set(`${order.company}:${order.transporter}:${order.id}`, order)
  }

  // Link disputes to orders, fill in missing data
  const processed: Dispute[] = disputes.map(dispute => {
    const matchedOrder =
      orderById.get(dispute.orderRef) ||
      orderById.get(`${dispute.company}:${dispute.transporter}:${dispute.orderRef}`)

    if (matchedOrder) {
      return {
        ...dispute,
        company: matchedOrder.company,
        transporter: matchedOrder.transporter,
      }
    }

    return dispute
  })

  // Deduplicate by orderRef + company + transporter
  const disputeMap = new Map<string, Dispute>()
  for (const dispute of processed) {
    const key = `${dispute.company}:${dispute.transporter}:${dispute.orderRef}:${dispute.type}`
    if (!disputeMap.has(key)) {
      disputeMap.set(key, dispute)
    }
  }

  return Array.from(disputeMap.values()).sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date)
    return a.orderRef.localeCompare(b.orderRef)
  })
}

/**
 * Link disputes back to orders (mutates order objects).
 */
export function linkDisputesToOrders(orders: Order[], disputes: Dispute[]): Order[] {
  const disputeByOrderRef = new Map<string, Dispute>()
  for (const dispute of disputes) {
    disputeByOrderRef.set(dispute.orderRef, dispute)
  }

  return orders.map(order => {
    const dispute = disputeByOrderRef.get(order.id)
    return dispute ? { ...order, dispute } : order
  })
}
