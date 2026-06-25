import Select from '../Select';
import Input from '../Input';
import { Car } from 'lucide-react';
import { useVehicleCatalog } from '../../hooks/useVehicleCatalog';
import { TRANSMISSION_OPTIONS } from '../../utils/vehicleCatalog';

const emptyValues = {
  carTypeId: '',
  modelName: '',
  vehicleNumber: '',
  transmission: 'manual',
};

/**
 * Reusable vehicle detail fields for user car registration.
 */
const VehicleDetailsForm = ({
  values = emptyValues,
  onChange,
  errors = {},
  disabled = false,
  showVehicleNumber = true,
  showCarModel = true,
}) => {
  const {
    categoryOptions,
    loading,
    error: catalogError,
  } = useVehicleCatalog({
    carTypeId: values.carTypeId,
  });

  const setField = (field) => (val) => {
    const next = { ...values, [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-5">
      {catalogError && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          {catalogError}
        </p>
      )}

      <Select
        label="Car category"
        options={categoryOptions}
        value={values.carTypeId}
        onChange={setField('carTypeId')}
        placeholder={loading ? 'Loading...' : 'Select category'}
        error={errors.carTypeId}
        searchable
        disabled={disabled || loading}
      />

      {showCarModel && (
        <Input
          label="Car model"
          placeholder="e.g. Toyota Innova Crysta"
          value={values.modelName}
          onChange={(e) => setField('modelName')(e.target.value)}
          error={errors.modelName}
          icon={Car}
          disabled={disabled}
        />
      )}

      {showVehicleNumber && (
        <Input
          label="Vehicle number"
          placeholder="e.g. MP09 AB 1234"
          value={values.vehicleNumber}
          onChange={(e) => setField('vehicleNumber')(e.target.value)}
          error={errors.vehicleNumber}
          icon={Car}
          className="uppercase"
          disabled={disabled}
        />
      )}

      <div className="grid grid-cols-1 gap-4">
        <Select
          label="Transmission"
          options={TRANSMISSION_OPTIONS}
          value={values.transmission}
          onChange={setField('transmission')}
          placeholder="Transmission"
          error={errors.transmission}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default VehicleDetailsForm;
export { emptyValues as emptyVehicleFormValues };
