export const getKitItemKey = (item, index) => item._id || item.clientKey || `idx-${index}`;
