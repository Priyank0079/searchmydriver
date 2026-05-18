export function appendKitOrderHistory(order, { field, from, to, note = '', by = null }) {
  order.statusHistory.push({
    field,
    from: from || '',
    to,
    note,
    by,
    at: new Date(),
  });
}
