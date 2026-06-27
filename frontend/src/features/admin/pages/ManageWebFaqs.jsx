import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  HelpCircle,
  X,
} from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Drawer from '../../../components/Drawer';
import api from '../../../utils/api';
import ConfirmDialog from '../../../components/ConfirmDialog';

const ManageWebFaqs = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingFaq, setEditingFaq] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/web-faqs/admin');
      setFaqs(res?.data?.data || []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load website FAQs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const handleNew = () => {
    setEditingFaq(null);
    setShowForm(true);
  };

  const handleEdit = (faq) => {
    setEditingFaq(faq);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingFaq(null);
    fetchFaqs();
  };

  const handleDelete = async () => {
    if (!confirmDelete?._id) return;
    setDeleting(true);
    try {
      await api.delete(`/web-faqs/admin/${confirmDelete._id}`);
      toast.success('FAQ deleted successfully');
      setConfirmDelete(null);
      fetchFaqs();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not delete FAQ');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Manage Website FAQs</h2>
          <p className="text-sm text-slate-500 font-medium">
            Publish and manage Frequently Asked Questions shown on the public landing website homepage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchFaqs} variant="outline" className="p-2.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleNew} className="rounded-xl font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add FAQ
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      {loading && faqs.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : faqs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No FAQs Published</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Click "Add FAQ" to publish your first frequently asked question.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq._id} className="border-slate-200 p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      faq.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {faq.isActive ? 'Active' : 'Draft'}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">Sort Order: {faq.sortOrder}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Q: {faq.question}</h3>
                <p className="text-sm text-slate-600 font-medium pl-5 border-l-2 border-slate-200 italic">{faq.answer}</p>
              </div>
              <div className="flex items-center gap-2 self-end md:self-start">
                <button
                  onClick={() => handleEdit(faq)}
                  className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete(faq)}
                  className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <FaqFormDrawer
          faq={editingFaq}
          onClose={() => {
            setShowForm(false);
            setEditingFaq(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          isOpen={!!confirmDelete}
          title="Delete FAQ"
          message={`Are you sure you want to delete this FAQ? It will be removed from the public website homepage.`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
        />
      )}
    </div>
  );
};

const FaqFormDrawer = ({ faq, onClose, onSaved }) => {
  const isEdit = !!faq;
  const [question, setQuestion] = useState(faq?.question || '');
  const [answer, setAnswer] = useState(faq?.answer || '');
  const [sortOrder, setSortOrder] = useState(faq?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(faq?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast.error('Question and Answer are required');
      return;
    }

    setSaving(true);
    const payload = {
      question: question.trim(),
      answer: answer.trim(),
      sortOrder: Number(sortOrder),
      isActive,
    };

    try {
      if (isEdit) {
        await api.put(`/web-faqs/admin/${faq._id}`, payload);
        toast.success('FAQ updated successfully');
      } else {
        await api.post('/web-faqs/admin', payload);
        toast.success('FAQ created successfully');
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save FAQ');
    } finally {
      setSaving(false);
    }
  };

  const drawerHeader = (
    <div className="px-5 py-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          {isEdit ? 'Edit FAQ' : 'New FAQ'}
        </p>
        <h2 className="text-base font-bold text-slate-900 truncate font-sans">
          {isEdit ? 'Edit FAQ Item' : 'Add FAQ Item'}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2 rounded-xl hover:bg-slate-100"
        aria-label="Close"
      >
        <X className="w-5 h-5 text-slate-600" />
      </button>
    </div>
  );

  const drawerFooter = (
    <div className="px-5 py-3 flex gap-3">
      <Button variant="outline" fullWidth onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button
        fullWidth
        loading={saving}
        onClick={handleSave}
      >
        {isEdit ? 'Save Changes' : 'Publish FAQ'}
      </Button>
    </div>
  );

  return (
    <Drawer isOpen onClose={onClose} header={drawerHeader} footer={drawerFooter} width="max-w-lg">
      <form onSubmit={handleSave} className="p-5 space-y-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Question Text
          </p>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How do I book a driver?"
            maxLength={250}
            required
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Answer Text
          </p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write the detailed answer here..."
            className="w-full h-32 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium text-slate-700"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Sort order
            </p>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Visibility
            </p>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700 font-medium">
                Show on website
              </span>
            </label>
          </div>
        </div>
      </form>
    </Drawer>
  );
};

export default ManageWebFaqs;
