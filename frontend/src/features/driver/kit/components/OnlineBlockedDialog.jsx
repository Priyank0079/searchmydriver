import { useNavigate } from 'react-router-dom';
import Modal from '../../../../components/Modal';
import Button from '../../../../components/Button';
import { Package, AlertCircle } from 'lucide-react';

const OnlineBlockedDialog = ({ open, onClose, blocked, onGoToKit }) => {
  const navigate = useNavigate();
  if (!open || !blocked) return null;

  const needsKit = blocked.code === 'KIT_REQUIRED' || blocked.reasons?.some((r) => r.toLowerCase().includes('kit'));

  const handleKitAction = () => {
    onClose();
    if (onGoToKit) {
      onGoToKit();
    } else {
      navigate('/driver/kit');
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Cannot go online">
      <div className="p-2 space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">{blocked.message}</p>
            {blocked.reasons?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {blocked.reasons.map((reason) => (
                  <li key={reason} className="text-xs text-amber-800">
                    • {reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {needsKit && (
          <Button
            fullWidth
            onClick={handleKitAction}
            className="flex items-center justify-center gap-2"
          >
            <Package className="w-4 h-4" />
            {onGoToKit ? 'View kit options' : 'Get driver kit'}
          </Button>
        )}
        <Button variant="outline" fullWidth onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

export default OnlineBlockedDialog;
