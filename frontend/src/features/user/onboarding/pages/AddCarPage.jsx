import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import DocumentUploadField from '../../../../components/DocumentUploadField';
import VehicleDetailsForm, { emptyVehicleFormValues } from '../../../../components/vehicle/VehicleDetailsForm';
import { ArrowLeft } from 'lucide-react';
import { MAX_USER_CARS } from '../../../../utils/constants';
import api from '../../../../utils/api';
import useUserAuthStore from '../../../../store/useUserAuthStore';
import { useDocumentsManager } from '../../../../hooks/useDocumentsManager';

const AddCarPage = () => {
  const navigate = useNavigate();
  const setOnboarding = useUserAuthStore((s) => s.setOnboarding);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyVehicleFormValues);
  const [errors, setErrors] = useState({});

  const {
    documents,
    uploadDocument,
    isAnyUploading,
  } = useDocumentsManager(['car_image']);

  const validate = () => {
    const newErrors = {};
    if (!formData.carTypeId) newErrors.carTypeId = 'Select car category';
    if (!formData.brandId) newErrors.brandId = 'Select car brand';
    if (!formData.modelId) newErrors.modelId = 'Select car model';
    if (!formData.vehicleNumber?.trim()) newErrors.vehicleNumber = 'Enter vehicle number';
    if (!formData.fuelTypeId) newErrors.fuelTypeId = 'Select fuel type';
    if (!formData.transmission) newErrors.transmission = 'Select transmission';
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
        carTypeId: formData.carTypeId,
        brandId: formData.brandId,
        modelId: formData.modelId,
        fuelTypeId: formData.fuelTypeId,
        vehicleNumber: formData.vehicleNumber.trim(),
        transmission: formData.transmission,
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
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">Add Your Car</h1>
          <p className="text-xs text-text-muted">Register your vehicle to find matching drivers</p>
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

          <VehicleDetailsForm
            values={formData}
            onChange={setFormData}
            errors={errors}
            disabled={loading || isAnyUploading}
          />
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
