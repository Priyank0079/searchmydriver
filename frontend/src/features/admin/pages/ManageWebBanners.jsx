import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Image as ImageIcon,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  LayoutTemplate,
  X,
  UploadCloud,
} from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Drawer from '../../../components/Drawer';
import api from '../../../utils/api';
import ConfirmDialog from '../../../components/ConfirmDialog';

const ManageWebBanners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingBanner, setEditingBanner] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/banners?type=web');
      setBanners(res?.data?.data || []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load web banners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleNew = () => {
    setEditingBanner(null);
    setShowForm(true);
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingBanner(null);
    fetchBanners();
  };

  const handleDelete = async () => {
    if (!confirmDelete?._id) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/banners/${confirmDelete._id}`);
      toast.success('Web banner deleted');
      setConfirmDelete(null);
      fetchBanners();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not delete web banner');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Manage Website Banners</h2>
          <p className="text-sm text-slate-500 font-medium">
            Publish and manage promotional banner slides shown on the public landing website homepage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchBanners} variant="outline" className="p-2.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleNew} className="rounded-xl font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Web Banner
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      {loading && banners.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <LayoutTemplate className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No Banners Published</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Click "Add Web Banner" to upload your first banner image.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map((banner) => (
            <Card key={banner._id} className="overflow-hidden flex flex-col justify-between border-slate-200">
              <div className="relative aspect-[21/9] bg-slate-100">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
                <span
                  className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    banner.isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {banner.isActive ? 'Active' : 'Draft'}
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{banner.title || 'Untitled Banner'}</h3>
                  <p className="text-xs text-slate-400 mt-1 truncate">
                    {banner.linkUrl ? (
                      <a
                        href={banner.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center gap-1"
                      >
                        {banner.linkUrl} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      'No click-through link'
                    )}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-t border-slate-100 pt-3">
                  <span>Sort Order: {banner.sortOrder}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(banner)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(banner)}
                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <BannerFormDrawer
          banner={editingBanner}
          onClose={() => {
            setShowForm(false);
            setEditingBanner(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Web Banner"
        description={`Are you sure you want to delete "${confirmDelete.title || 'this banner'}"? This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(null)}
        loading={deleting}
      />
    </div>
  );
};

const BannerFormDrawer = ({ banner, onClose, onSaved }) => {
  const isEdit = !!banner;
  const [title, setTitle] = useState(banner?.title || '');
  const [linkUrl, setLinkUrl] = useState(banner?.linkUrl || '');
  const [sortOrder, setSortOrder] = useState(banner?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl || '');
  const [imagePublicId, setImagePublicId] = useState(banner?.imagePublicId || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('media', file);
    if (imagePublicId) {
      formData.append('oldPublicId', imagePublicId);
    }

    setUploading(true);
    try {
      const res = await api.post('/admin/banners/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(res.data.data.url);
      setImagePublicId(res.data.data.publicId);
      toast.success('Banner image uploaded');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!imageUrl) {
      toast.error('Please upload a banner image');
      return;
    }

    setSaving(true);
    const payload = {
      title,
      imageUrl,
      imagePublicId,
      linkUrl,
      sortOrder: Number(sortOrder),
      isActive,
      type: 'web',
    };

    try {
      if (isEdit) {
        await api.put(`/admin/banners/${banner._id}`, payload);
        toast.success('Web banner updated');
      } else {
        await api.post('/admin/banners', payload);
        toast.success('Web banner created');
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save web banner');
    } finally {
      setSaving(false);
    }
  };

  const drawerHeader = (
    <div className="px-5 py-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          {isEdit ? 'Edit Web Banner' : 'New Web Banner'}
        </p>
        <h2 className="text-base font-bold text-slate-900 truncate">
          {isEdit ? title || 'Untitled Banner' : 'Create Web Banner'}
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
        disabled={uploading || !imageUrl}
        onClick={handleSave}
      >
        {isEdit ? 'Save Changes' : 'Publish Banner'}
      </Button>
    </div>
  );

  return (
    <Drawer isOpen onClose={onClose} header={drawerHeader} footer={drawerFooter} width="max-w-xl">
      <form onSubmit={handleSave} className="p-5 space-y-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Banner Image (16:9 ratio)
          </p>
          <label
            className={`flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-2xl border-2 border-dashed cursor-pointer transition ${
              imageUrl
                ? 'border-emerald-300 bg-emerald-50/40'
                : 'border-slate-300 hover:border-primary hover:bg-primary/5'
            } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            {uploading ? (
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            ) : imageUrl ? (
              <>
                <ImageIcon className="w-6 h-6 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-800">
                  Click to replace image
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="w-7 h-7 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">
                  Click to upload
                </p>
                <p className="text-[11px] text-slate-500 text-center">
                  Image up to 5 MB (JPG/PNG/WEBP). Recommended 16:9.
                </p>
              </>
            )}
          </label>
          {imageUrl && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
              <img
                src={imageUrl}
                alt="Banner preview"
                className="w-full object-cover aspect-[16/9]"
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Banner Title (Optional)
          </p>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Website Home Banner"
            maxLength={120}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Click-through link (optional)
          </p>
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://yourpartner.com/landing"
            icon={ExternalLink}
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
            <p className="text-[11px] text-slate-500 mt-1.5">
              Lower numbers appear first.
            </p>
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
                Show on public website
              </span>
            </label>
          </div>
        </div>
      </form>
    </Drawer>
  );
};

export default ManageWebBanners;
