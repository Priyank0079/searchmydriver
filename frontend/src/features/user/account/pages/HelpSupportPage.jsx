import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Headphones, Mail, Phone, MessageSquare } from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import HelpDeskModal from '../../../../components/HelpDeskModal';

export default function HelpSupportPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <Header onBack={() => navigate('/user/account')} />
      <div className="flex-1 p-4 space-y-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-text">Need help?</h2>
              <p className="text-sm text-text-secondary">Open a support ticket and our team will follow up.</p>
            </div>
          </div>
          <Button fullWidth onClick={() => setOpen(true)}>Open support form</Button>
        </Card>

        <Card className="p-4 space-y-3">
          <a href="tel:9981570665" className="flex items-center gap-3 rounded-2xl border border-border-light px-3 py-3 bg-white">
            <Phone className="w-4 h-4 text-text-secondary" />
            <span className="text-sm font-medium text-text">9981570665</span>
          </a>
          <a href="mailto:Searchmydrivers@gmail.com" className="flex items-center gap-3 rounded-2xl border border-border-light px-3 py-3 bg-white">
            <Mail className="w-4 h-4 text-text-secondary" />
            <span className="text-sm font-medium text-text">Searchmydrivers@gmail.com</span>
          </a>
          <div className="flex items-center gap-3 rounded-2xl border border-border-light px-3 py-3 bg-white">
            <MessageSquare className="w-4 h-4 text-text-secondary" />
            <span className="text-sm font-medium text-text">We usually reply within 24 hours.</span>
          </div>
        </Card>
      </div>

      <HelpDeskModal isOpen={open} onClose={() => setOpen(false)} userType="user" />
    </div>
  );
}

function Header({ onBack }) {
  return (
    <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">Help & Support</h1>
          <p className="text-xs text-text-muted">Contact our team</p>
        </div>
      </div>
    </div>
  );
}
