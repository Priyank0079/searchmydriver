import { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import api from '../utils/api';

const HelpDeskModal = ({ isOpen, onClose, userType, isPublic = false }) => {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    if (isPublic && (!contactName.trim() || !contactPhone.trim())) {
      setError('Please provide your name and phone number');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint = isPublic
        ? (userType === 'user' ? '/auth/support/public-ticket' : '/driver/support/public-ticket')
        : (userType === 'user' ? '/auth/support/ticket' : '/driver/support/ticket');

      const payload = isPublic
        ? { subject, description, contactName, contactPhone, creatorType: userType }
        : { subject, description };

      await api.post(endpoint, payload);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubject('');
    setDescription('');
    setContactName('');
    setContactPhone('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (success) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Ticket Submitted">
        <div className="flex flex-col items-center py-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">We got your request!</h3>
          <p className="text-sm text-slate-500 text-center mb-6">
            Our support team has been notified and will reach out to you shortly.
          </p>
          <Button fullWidth onClick={handleClose}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Help Desk">
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        {isPublic && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                placeholder="John Doe"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                placeholder="Mobile number"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            How can we help?
          </label>
          <input
            type="text"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
            placeholder="e.g., Issue with a recent ride, Payment question"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Details
          </label>
          <textarea
            rows={4}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
            placeholder="Please provide as much information as possible so we can assist you better..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && (
          <div className="text-sm text-rose-600 bg-rose-50 px-4 py-3 rounded-lg border border-rose-100 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            fullWidth
            loading={loading}
            icon={Send}
            className="shadow-sm font-medium"
          >
            Send Message
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default HelpDeskModal;
