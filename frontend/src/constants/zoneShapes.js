export const ZONE_SHAPE = Object.freeze({
  CIRCLE: 'circle',
  POLYGON: 'polygon',
});

export const ZONE_SHAPE_OPTIONS = [
  { value: ZONE_SHAPE.CIRCLE, label: 'Radius (circle)', description: 'Center point + km radius' },
  { value: ZONE_SHAPE.POLYGON, label: 'Pentagon', description: 'Five-corner custom area' },
];

export const PENTAGON_VERTICES = 5;
