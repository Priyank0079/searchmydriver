import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Image as ImageIcon,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  MapPin,
  X,
  UploadCloud,
} from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Drawer from '../../../components/Drawer';
import api from '../../../utils/api';
import ConfirmDialog from '../../../components/ConfirmDialog';

const ManageWebCities = () => {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCity, setEditingCity] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/web-cities/admin');
      setCities(res?.data?.data || []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load website cities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCities();
  }, [fetchCities]);

  const handleNew = () => {
    setEditingCity(null);
    setShowForm(true);
  };

  const handleEdit = (city) => {
    setEditingCity(city);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingCity(null);
    fetchCities();
  };

  const handleDelete = async () => {
    if (!confirmDelete?._id) return;
    setDeleting(true);
    try {
      await api.delete(`/web-cities/admin/${confirmDelete._id}`);
      toast.success('City deleted successfully');
      setConfirmDelete(null);
      fetchCities();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not delete city');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Manage Website Cities</h2>
          <p className="text-sm text-slate-500 font-medium">
            Publish and manage the serviced cities shown on the public landing website homepage under "Cities We Cater".
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchCities} variant="outline" className="p-2.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleNew} className="rounded-xl font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add City
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      {loading && cities.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : cities.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <MapPin className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No Cities Published</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Click "Add City" to register your first serviced city with its image.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {cities.map((city) => (
            <Card key={city._id} className="overflow-hidden flex flex-col justify-between border-slate-200 p-4 text-center space-y-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto">
                <img
                  src={city.imageUrl}
                  alt={city.name}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm capitalize">{city.name}</h3>
                <span
                  className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1.5 ${
                    city.isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {city.isActive ? 'Active' : 'Hidden'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold border-t border-slate-100 pt-3">
                <span>Order: {city.sortOrder}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleEdit(city)}
                    className="p-1 hover:bg-slate-100 text-slate-600 rounded transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(city)}
                    className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <CityFormDrawer
          city={editingCity}
          onClose={() => {
            setShowForm(false);
            setEditingCity(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          isOpen={!!confirmDelete}
          title="Delete Serviced City"
          message={`Are you sure you want to delete "${confirmDelete.name}"? This will remove it from the public homepage.`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
        />
      )}
    </div>
  );
};

const CityFormDrawer = ({ city, onClose, onSaved }) => {
  const isEdit = !!city;
  const [name, setName] = useState(city?.name || '');
  const [sortOrder, setSortOrder] = useState(city?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(city?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState(city?.imageUrl || '');
  const [imagePublicId, setImagePublicId] = useState(city?.imagePublicId || '');
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
      const res = await api.post('/web-cities/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(res.data.data.url);
      setImagePublicId(res.data.data.publicId);
      toast.success('City icon uploaded successfully');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('City name is required');
      return;
    }
    if (!imageUrl) {
      toast.error('Please upload a city icon/image');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      imageUrl,
      imagePublicId,
      sortOrder: Number(sortOrder),
      isActive,
    };

    try {
      if (isEdit) {
        await api.put(`/web-cities/admin/${city._id}`, payload);
        toast.success('City updated successfully');
      } else {
        await api.post('/web-cities/admin', payload);
        toast.success('City created successfully');
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save city details');
    } finally {
      setSaving(false);
    }
  };

  const drawerHeader = (
    <div className="px-5 py-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          {isEdit ? 'Edit City' : 'New City'}
        </p>
        <h2 className="text-base font-bold text-slate-900 truncate font-sans">
          {isEdit ? name || 'Untitled City' : 'Add Serviced City'}
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
        {isEdit ? 'Save Changes' : 'Publish City'}
      </Button>
    </div>
  );

  return (
    <Drawer isOpen onClose={onClose} header={drawerHeader} footer={drawerFooter} width="max-w-md">
      <form onSubmit={handleSave} className="p-5 space-y-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            City Icon / Pin Image
          </p>
          <label
            className={`flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-2xl border-2 border-dashed cursor-pointer transition ${
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
                  Image up to 3 MB (JPG/PNG/WEBP).
                </p>
              </>
            )}
          </label>
          {imageUrl && (
            <div className="mt-3 rounded-2xl p-4 border border-slate-200 bg-slate-50 flex items-center justify-center">
              <img
                src={imageUrl}
                alt="City preview"
                className="w-12 h-12 object-contain"
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            City Name
          </p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Delhi NCR"
            maxLength={100}
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

export default ManageWebCities;
