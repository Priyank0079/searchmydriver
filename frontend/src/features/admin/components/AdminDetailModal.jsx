import Modal from '../../../components/Modal';

const AdminDetailModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerExtra,
  children,
  footer,
  size = 'xl',
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title="" size={size}>
    <div className="flex flex-col max-h-[92vh] bg-white rounded-3xl overflow-hidden">
      <HeaderBlock headerExtra={headerExtra} title={title} subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto bg-slate-50 px-4 sm:px-6 py-5">{children}</div>
      {footer ? (
        <div className="border-t border-slate-100 bg-white p-4 sm:p-5 shrink-0">{footer}</div>
      ) : null}
    </div>
  </Modal>
);

function HeaderBlock({ headerExtra, title, subtitle }) {
  return (
    <div className="border-b border-slate-100 px-4 sm:px-6 py-5 bg-white shrink-0">
      {headerExtra || (
        <div>
          {title ? <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">{title}</h2> : null}
          {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
        </div>
      )}
    </div>
  );
}

export default AdminDetailModal;
