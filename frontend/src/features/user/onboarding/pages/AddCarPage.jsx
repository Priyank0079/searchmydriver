import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MAX_USER_CARS } from '../../../../utils/constants';
import AddCarForm from '../components/AddCarForm';

const AddCarPage = () => {
  const navigate = useNavigate();

  const handleSuccess = ({ carCount }) => {
    if (carCount >= MAX_USER_CARS) {
      navigate('/user/checklist', { replace: true });
    } else {
      navigate('/user/my-cars', { replace: true });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">Add Your Car</h1>
          <p className="text-xs text-text-muted">
            Register your vehicle to find matching drivers
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-4 pb-8 animate-fade-in-up">
        <AddCarForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
};

export default AddCarPage;
