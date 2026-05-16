/**
 * Stable cache key from a namespace + serializable params.
 * @example buildCacheKey('admin-users', { page: 1, limit: 10, search: 'raj' })
 */
export function buildCacheKey(namespace, params = {}) {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {});

  return `${namespace}:${JSON.stringify(sorted)}`;
}
