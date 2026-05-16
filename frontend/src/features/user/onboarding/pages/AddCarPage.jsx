import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import Select from '../../../../components/Select';
import DocumentUploadField from '../../../../components/DocumentUploadField';
import { ArrowLeft, Car, Fuel, Settings, Camera } from 'lucide-react';
import { CAR_BRANDS, FUEL_TYPES, MAX_USER_CARS } from '../../../../utils/constants';
import api from '../../../../utils/api';
import useUserAuthStore from '../../../../store/useUserAuthStore';
import { useDocumentsManager } from '../../../../hooks/useDocumentsManager';

const AddCarPage = () => {
  const navigate = useNavigate();
  const setOnboarding = useUserAuthStore((s) => s.setOnboarding);
  const [loading, setLoading] = useState(false);
  const [carTypes, setCarTypes] = useState([]);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    vehicleNumber: '',
    fuelType: '',
    transmission: 'manual',
    carType: '',
  });
  const [errors, setErrors] = useState({});

  const {
    documents,
    uploadDocument,
    isAnyUploading,
  } = useDocumentsManager(['car_image']);

  useEffect(() => {
    const fetchCarTypes = async () => {
      try {
        const res = await api.get('/common/car-types');
        // Ensure we map t._id to 'value' as expected by the Select component
        const types = res.data.data.map(t => ({
          value: String(t._id),
          label: t.name
        }));
        setCarTypes(types);
      } catch (err) {
        console.error('Failed to fetch car types', err);
      }
    };
    fetchCarTypes();
  }, []);

  const handleSelectChange = (field) => (val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleChange = (field) => (e) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.brand) newErrors.brand = 'Select car brand';
    if (!formData.model) newErrors.model = 'Enter car model';
    if (!formData.vehicleNumber) newErrors.vehicleNumber = 'Enter vehicle number';
    if (!formData.fuelType) newErrors.fuelType = 'Select fuel type';
    if (!formData.carType) newErrors.carTypeId = 'Select car type';
    if (!documents.car_image?.url) newErrors.image = 'Car image is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await api.post('/auth/cars', {
        ...formData,
        carTypeId: formData.carType,
        fuelType: formData.fuelType.toLowerCase(),
        transmission: formData.transmission.toLowerCase(),
        image: documents.car_image.url,
      });

      const { carCount = 1 } = res.data.data ?? {};
      setOnboarding({
        carCount,
        hasCar: carCount > 0,
        hasChecklist: false,
      });
      if (carCount >= MAX_USER_CARS) {
        navigate('/user/checklist', { replace: true });
      } else {
        navigate('/user/my-cars', { replace: true });
      }
    } catch (err) {
      console.error('Failed to add car', err);
      alert(err.response?.data?.message || 'Failed to add car');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">Add Your Car</h1>
          <p className="text-xs text-text-muted">Register your vehicle to continue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <div className="flex-1 space-y-5 animate-fade-in-up">
          <DocumentUploadField
            label="Car Photo"
            doc={documents.car_image}
            onUpload={(file) => uploadDocument('car_image', file)}
            hint="Clear photo of the car"
            disabled={isAnyUploading}
          />
          {errors.image && <p className="text-danger text-xs -mt-3">{errors.image}</p>}

          <Select
            label="Car Category"
            options={carTypes}
            value={formData.carType}
            onChange={handleSelectChange('carType')}
            placeholder="Select Category"
            error={errors.carTypeId}
          />

          <Select
            label="Car Brand"
            options={CAR_BRANDS}
            value={formData.brand}
            onChange={handleSelectChange('brand')}
            placeholder="Select Brand"
            error={errors.brand}
          />

          <Input
            label="Car Model"
            placeholder="e.g. Swift Dzire"
            value={formData.model}
            onChange={handleChange('model')}
            error={errors.model}
            icon={Car}
          />

          <Input
            label="Vehicle Number"
            placeholder="e.g. MP09 AB 1234"
            value={formData.vehicleNumber}
            onChange={handleChange('vehicleNumber')}
            error={errors.vehicleNumber}
            className="uppercase"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Fuel Type"
              options={FUEL_TYPES}
              value={formData.fuelType}
              onChange={handleSelectChange('fuelType')}
              placeholder="Fuel"
              error={errors.fuelType}
            />

            <Select
              label="Transmission"
              options={['manual', 'automatic']}
              value={formData.transmission}
              onChange={handleSelectChange('transmission')}
              placeholder="Transmission"
            />
          </div>
        </div>

        <div className="pt-6">
          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={isAnyUploading || loading}
            className="rounded-full py-4 text-base font-bold"
          >
            {isAnyUploading ? 'Uploading Image...' : 'Save & Continue'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddCarPage;
