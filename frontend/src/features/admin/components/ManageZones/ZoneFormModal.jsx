import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import Modal from '../../../../components/Modal';
import Toggle from '../../../../components/Toggle';
import ZoneShapeTypePicker from '../../../../components/maps/ZoneShapeTypePicker';
import ZoneMapEditor from '../../../../components/maps/ZoneMapEditor';
import { ZONE_SHAPE } from '../../../../constants/zoneShapes';
import { generateRegularPolygon, centerFromForm } from '../../../../utils/zoneMapGeometry';

const ZoneFormModal = ({
  isOpen,
  onClose,
  editing,
  form,
  onChange,
  onGeometryChange,
  onSubmit,
  submitting,
}) => {
  const handleShapeTypeChange = (shapeType) => {
    if (shapeType === ZONE_SHAPE.POLYGON) {
      const center = centerFromForm(form);
      const radiusKm = Number(form.radiusKm) || 5;
      onGeometryChange({
        shapeType: ZONE_SHAPE.POLYGON,
        polygonPoints: generateRegularPolygon(center, radiusKm, 5),
        lat: String(center.lat),
        lng: String(center.lng),
      });
      return;
    }

    onGeometryChange({
      shapeType: ZONE_SHAPE.CIRCLE,
      polygonPoints: [],
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit service zone' : 'Create service zone'}
      size="3xl"
    >
      <form onSubmit={onSubmit} className="space-y-4 p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Input
              label="Zone name"
              placeholder="e.g. South Delhi"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              required
            />
            <Input
              label="Zone code"
              placeholder="south-delhi (auto from name if empty)"
              value={form.code}
              onChange={(e) => onChange('code', e.target.value)}
            />
            <Input
              label="City"
              placeholder="e.g. New Delhi"
              value={form.city}
              onChange={(e) => onChange('city', e.target.value)}
            />
            <Input
              label="Description"
              placeholder="Optional notes for admins"
              value={form.description}
              onChange={(e) => onChange('description', e.target.value)}
            />

            <div>
              <p className="text-sm font-medium text-slate-800 mb-2">Zone shape</p>
              <ZoneShapeTypePicker
                value={form.shapeType}
                onChange={handleShapeTypeChange}
                disabled={submitting}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">Active</p>
                <p className="text-xs text-slate-500">Inactive zones are hidden from dispatch</p>
              </div>
              <Toggle checked={form.isActive} onChange={(v) => onChange('isActive', v)} />
            </div>

            <Input
              label="Sort order"
              type="number"
              value={form.sortOrder}
              onChange={(e) => onChange('sortOrder', e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-800">Coverage on map</p>
            <ZoneMapEditor
              active={isOpen}
              shapeType={form.shapeType}
              lat={form.lat}
              lng={form.lng}
              radiusKm={form.radiusKm}
              polygonPoints={form.polygonPoints}
              onChange={onGeometryChange}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth loading={submitting}>
            {editing ? 'Save changes' : 'Create zone'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ZoneFormModal;
