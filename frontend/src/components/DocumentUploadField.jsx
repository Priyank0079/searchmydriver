import { useRef } from 'react';
import { Upload, Loader2, CheckCircle } from 'lucide-react';

const inputClassName =
  'absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer disabled:cursor-not-allowed';

/**
 * Single document slot — disables input while uploading; does not auto-upload on mount.
 */
const DocumentUploadField = ({
  label,
  doc = { url: null, publicId: null, loading: false },
  onUpload,
  accept = 'image/*',
  variant = 'card',
  hint,
  disabled = false,
}) => {
  const inputRef = useRef(null);
  const isBusy = disabled || doc.loading;

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isBusy) return;

    try {
      await onUpload(file);
    } catch {
      // Caller may show alert
    }
  };

  if (variant === 'grid') {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={isBusy}
          className={inputClassName}
        />
        <GridPreview label={label} doc={doc} isBusy={isBusy} />
      </div>
    );
  }

  return (
    <div>
      {label && <label className="text-sm font-medium text-text mb-3 block">{label}</label>}
      <div className="relative">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={isBusy}
          className={inputClassName}
        />
        <div
          className={`w-full border-2 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-colors overflow-hidden relative min-h-[140px]
            ${doc.url ? 'border-primary border-solid' : 'border-dashed border-border'}
            ${isBusy ? 'opacity-70' : 'hover:border-primary hover:bg-primary/5'}
          `}
        >
          {doc.loading ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : doc.url ? (
            <>
              <img src={doc.url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
              <CheckCircle className="w-8 h-8 text-primary z-0 bg-white rounded-full" />
              <span className="text-sm text-primary font-medium z-0 bg-white px-2 rounded">Uploaded</span>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-text-muted" />
              <span className="text-sm text-text-secondary">Tap to upload</span>
              {hint && <span className="text-xs text-text-muted">{hint}</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function GridPreview({ label, doc, isBusy }) {
  return (
    <div
      className={`aspect-square border-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all overflow-hidden relative
        ${doc.url ? 'border-primary border-solid' : 'border-dashed border-border'}
        ${isBusy ? 'opacity-70' : 'hover:border-primary hover:bg-primary/5'}
      `}
    >
      {doc.loading ? (
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      ) : doc.url ? (
        <>
          <img src={doc.url} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
            <Upload className="w-5 h-5 text-white" />
          </div>
        </>
      ) : (
        <>
          <Upload className="w-5 h-5 text-text-muted" />
          <span className="text-[10px] text-text-muted text-center px-1">{label}</span>
        </>
      )}
    </div>
  );
}

export default DocumentUploadField;
