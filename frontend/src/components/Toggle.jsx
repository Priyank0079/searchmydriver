const Toggle = ({
  checked = false,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-12 h-7 bg-gray-200 rounded-full peer peer-checked:bg-success transition-colors duration-300" />
        <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-5" />
      </div>
      {label && (
        <span className="text-sm font-medium text-text">{label}</span>
      )}
    </label>
  );
};

export default Toggle;
