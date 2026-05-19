const AuthDivider = ({ label = 'or' }) => (
  <div className="flex items-center gap-3 my-5">
    <div className="flex-1 h-px bg-border" />
    <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

export default AuthDivider;
