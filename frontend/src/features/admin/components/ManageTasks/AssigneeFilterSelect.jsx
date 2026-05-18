import { User } from 'lucide-react';
import Select from '../../../../components/Select';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { useAdminTaskAssigneesStore } from '../../../../store/admin/useAdminTasksStore';
import useAdminAuthStore from '../../../../store/useAdminAuthStore';
import { hasOperationalAccess } from '../../../../constants/staffRoles';

const AssigneeFilterSelect = ({ value, onChange, includeMine = true }) => {
  const { admin } = useAdminAuthStore();

  if (!hasOperationalAccess(admin?.role)) return null;
  const { data } = useCachedQuery(
    useAdminTaskAssigneesStore,
    'admin-task-assignees',
    {},
  );
  const assignees = Array.isArray(data) ? data : [];

  const options = [
    { value: '', label: 'All assignments' },
    { value: 'unassigned', label: 'Unassigned only' },
  ];

  if (includeMine && admin?._id) {
    options.push({ value: admin._id, label: 'Assigned to me' });
  }

  assignees.forEach((u) => {
    if (u._id === admin?._id && includeMine) return;
    options.push({ value: u._id, label: u.name || u.email });
  });

  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder="Assignment"
      options={options}
      icon={User}
    />
  );
};

export default AssigneeFilterSelect;
