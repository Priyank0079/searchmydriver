import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, User } from 'lucide-react';
import Avatar from '../../../components/Avatar';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import { STAFF_ROLE_LABELS } from '../../../constants/staffRoles';

const AdminUserMenu = () => {
  const navigate = useNavigate();
  const { admin, logout } = useAdminAuthStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!admin) return null;

  const roleLabel = STAFF_ROLE_LABELS[admin.role] || admin.role;

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/admin/login');
  };

  return (
    <div ref={containerRef} className="relative ml-1 pl-3 border-l border-gray-100">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2.5 rounded-xl py-1.5 pr-1 hover:bg-gray-50 transition-colors"
      >
        <Avatar name={admin.name} size="sm" src={admin.profilePicture} />
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-text leading-tight truncate max-w-[140px]">
            {admin.name}
          </p>
          <p className="text-[10px] text-text-muted">{roleLabel}</p>
        </div>
        <ChevronDown
          className={`hidden sm:block w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/admin/profile');
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <User className="w-4 h-4 text-slate-400" />
            Profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors border-t border-slate-50"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminUserMenu;
