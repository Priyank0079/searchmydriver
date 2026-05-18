import { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import { toSelectOptions } from '../utils/vehicleCatalog';

/**
 * Fetches vehicle catalog data (categories, fuel, brands, models).
 * Models refetch when brandId or carTypeId changes.
 */
export function useVehicleCatalog({ activeOnly = true, brandId = '', carTypeId = '' } = {}) {
  const [categories, setCategories] = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [error, setError] = useState('');

  const activeQuery = activeOnly ? '?active=true' : '';

  const loadBaseCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catRes, fuelRes, brandRes] = await Promise.all([
        api.get(`/common/car-types${activeQuery}`),
        api.get(`/common/fuel-types${activeQuery}`),
        api.get(`/common/car-brands${activeQuery}`),
      ]);
      setCategories(catRes.data.data || []);
      setFuelTypes(fuelRes.data.data || []);
      setBrands(brandRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load vehicle options');
    } finally {
      setLoading(false);
    }
  }, [activeQuery]);

  const loadModels = useCallback(async () => {
    if (!brandId) {
      setModels([]);
      return;
    }
    setModelsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeOnly) params.set('active', 'true');
      params.set('brandId', brandId);
      if (carTypeId) params.set('carTypeId', carTypeId);
      const res = await api.get(`/common/car-models?${params.toString()}`);
      setModels(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load car models');
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [activeOnly, brandId, carTypeId]);

  useEffect(() => {
    loadBaseCatalog();
  }, [loadBaseCatalog]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return {
    categories,
    fuelTypes,
    brands,
    models,
    categoryOptions: toSelectOptions(categories),
    fuelOptions: toSelectOptions(fuelTypes),
    brandOptions: toSelectOptions(brands),
    modelOptions: toSelectOptions(models),
    loading,
    modelsLoading,
    error,
    reload: loadBaseCatalog,
  };
}
