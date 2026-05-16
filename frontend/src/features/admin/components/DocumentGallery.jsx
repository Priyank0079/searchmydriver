import { DOCUMENT_LABELS, dedupeDocumentsForDisplay } from '../../../utils/documents';

const DocumentGallery = ({ documents = [], emptyMessage = 'No documents uploaded' }) => {
  const items = dedupeDocumentsForDisplay(documents);

  if (!items.length) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((doc) => (
        <a
          key={doc.type}
          href={doc.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-[4/3]"
        >
          <img
            src={doc.fileUrl}
            alt={DOCUMENT_LABELS[doc.type] || doc.type}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <p className="text-[10px] text-white font-medium truncate">
              {DOCUMENT_LABELS[doc.type] || doc.type.replace(/_/g, ' ')}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
};

export default DocumentGallery;
