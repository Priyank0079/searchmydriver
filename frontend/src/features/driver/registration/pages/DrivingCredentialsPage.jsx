import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import Select from '../../../../components/Select';
import StepIndicator from '../../../../components/StepIndicator';
import DocumentUploadField from '../../../../components/DocumentUploadField';
import { ArrowLeft, FileText, Calendar, Briefcase, ChevronDown, X, Search, Check } from 'lucide-react';
import api from '../../../../utils/api';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import { useDocumentsManager } from '../../../../hooks/useDocumentsManager';

const steps = ['Identity', 'Credentials', 'Bank', 'Safety', 'Training'];
const MAX_CAR_TYPES = 5;
const CREDENTIAL_DOC_TYPES = ['driving_license', 'selfie'];

const DOC_LABELS = {
  driving_license: 'DL Photo',
  selfie: 'Selfie/Photo',
};

const DrivingCredentialsPage = () => {
  const navigate = useNavigate();
  const updateDriver = useDriverAuthStore((state) => state.updateDriver);

  const [form, setForm] = useState({ license: '', expiry: '', experience: '', availability: '' });
  const [carTypes, setCarTypes] = useState([]);
  const [selectedCarTypes, setSelectedCarTypes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const {
    documents,
    loadFromApiDocuments,
    uploadDocument,
    isAnyUploading,
    allRequiredUploaded,
    toPayloadArray,
  } = useDocumentsManager(CREDENTIAL_DOC_TYPES);

  const handleSelectChange = (f) => (val) => setForm((p) => ({ ...p, [f]: val }));
  const handleChange = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleContinue = async () => {
    if (!allRequiredUploaded(CREDENTIAL_DOC_TYPES)) {
      alert('Please upload both required documents');
      return;
    }

    try {
      setIsSubmitting(true);

      await api.put('/driver/onboarding/step', {
        stepNumber: 2,
        stepData: {
          drivingLicense: {
            number: form.license,
            expiryDate: form.expiry || null,
          },
          experienceYears: Number(form.experience) || 0,
          availability: form.availability.toLowerCase().replace(' ', '-'),
          carTypeExperience: selectedCarTypes,
          documents: toPayloadArray(),
        },
      });

      updateDriver({ onboardingStep: 3 });
      navigate('/driver/register/bank');
    } catch (error) {
      console.error('Failed to save step 2', error);
      alert(error.response?.data?.message || 'Failed to save credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [carRes, profileRes] = await Promise.all([
          api.get('/common/car-types'),
          api.get('/driver/profile')
        ]);

        setCarTypes(carRes.data.data);
        
        const data = profileRes.data.data;
        if (data) {
          setForm({
            license: data.drivingLicense?.number || '',
            expiry: data.drivingLicense?.expiryDate ? data.drivingLicense.expiryDate.split('T')[0] : '',
            experience: data.experienceYears?.toString() || '',
            availability:
              data.availability === 'full-time'
                ? 'Full-time'
                : data.availability === 'part-time'
                  ? 'Part-time'
                  : data.availability === 'weekends-only'
                    ? 'Weekends Only'
                    : '',
          });
          if (data.carTypeExperience) setSelectedCarTypes(data.carTypeExperience);
          if (data.documents) loadFromApiDocuments(data.documents);
        }
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      }
    };
    fetchData();
  }, [loadFromApiDocuments]);

  const toggleCarType = (id) => {
    setSelectedCarTypes((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= MAX_CAR_TYPES) return prev;
      return [...prev, id];
    });
  };

  const removeCarType = (id) => {
    setSelectedCarTypes((prev) => prev.filter((t) => t !== id));
  };

  const filteredTypes = carTypes.filter((car) =>
    car.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedCars = carTypes.filter((c) => selectedCarTypes.includes(c._id));

  const continueDisabled =
    !form.license ||
    !form.experience ||
    !form.availability ||
    selectedCarTypes.length === 0 ||
    isSubmitting ||
    isAnyUploading ||
    !allRequiredUploaded(CREDENTIAL_DOC_TYPES);

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh">
      <div className="px-4 pt-4">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 pt-2 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold">Driving Credentials</h1>
          <span className="text-xs text-text-muted bg-bg px-2 py-1 rounded-full">2/5</span>
        </div>
        <StepIndicator steps={steps} currentStep={2} />
        <p className="text-xs text-text-muted mt-3">License, experience & car expertise</p>
      </div>
      <form className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto">
        <div className="flex-1 space-y-5 animate-fade-in-up">
          <Input label="License number" placeholder="DL-XXXX-XXXX" value={form.license} onChange={handleChange('license')} icon={FileText} />
          <Input label="DL expiry" type="date" value={form.expiry} onChange={handleChange('expiry')} icon={Calendar} />
          <Input label="Experience (years)" type="number" placeholder="Years of driving" value={form.experience} onChange={handleChange('experience')} icon={Briefcase} />
          <Select label="Availability" options={['Full-time', 'Part-time', 'Weekends Only']} value={form.availability} onChange={handleSelectChange('availability')} placeholder="Select availability" openDirection="top" />

          <div ref={dropdownRef} className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-text">Car type experience</label>
              <span className="text-xs text-text-muted">{selectedCarTypes.length}/{MAX_CAR_TYPES}</span>
            </div>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`w-full flex items-center justify-between h-12 px-4 border rounded-xl bg-white text-sm transition-all duration-200
                ${dropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-gray-300'}
                ${selectedCarTypes.length >= MAX_CAR_TYPES ? 'opacity-70' : ''}
              `}
            >
              <span className={selectedCarTypes.length > 0 ? 'text-text' : 'text-text-muted'}>
                {selectedCarTypes.length > 0
                  ? `${selectedCarTypes.length} car type${selectedCarTypes.length > 1 ? 's' : ''} selected`
                  : 'Select car types you can drive'}
              </span>
              <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute z-50 left-0 right-0 bottom-full mb-1.5 bg-white border border-border rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-3 border-b border-border-light">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search car type..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                      className="w-full h-10 bg-bg rounded-xl pl-10 pr-4 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {filteredTypes.map((car) => {
                    const isSelected = selectedCarTypes.includes(car.id);
                    const isDisabled = !isSelected && selectedCarTypes.length >= MAX_CAR_TYPES;
                    return (
                      <button
                        key={car._id}
                        type="button"
                        onClick={() => { if (!isDisabled) toggleCarType(car._id); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                          ${isSelected ? 'bg-primary/5' : isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'}
                        `}
                      >
                        <span className={`flex-1 text-sm ${isSelected ? 'font-semibold text-primary-dark' : 'text-text'}`}>{car.name}</span>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {selectedCars.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedCars.map((car) => (
                  <div key={car._id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-bg text-sm">
                    <span className="text-xs font-medium text-text">{car.name}</span>
                    <button type="button" onClick={() => removeCarType(car._id)} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-200 text-text-muted"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-text mb-2 block">Documents</label>
            <div className="grid grid-cols-2 gap-4">
              {CREDENTIAL_DOC_TYPES.map((type) => (
                <DocumentUploadField
                  key={type}
                  label={DOC_LABELS[type]}
                  variant="grid"
                  doc={documents[type]}
                  onUpload={(file) => uploadDocument(type, file)}
                  disabled={isAnyUploading}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="pt-5">
          <Button
            fullWidth
            onClick={handleContinue}
            disabled={continueDisabled}
            loading={isSubmitting}
            className="mt-6 rounded-full py-4 text-base font-bold shadow-lg shadow-primary/20"
          >
            {isAnyUploading ? 'UPLOADING...' : 'CONTINUE'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DrivingCredentialsPage;
