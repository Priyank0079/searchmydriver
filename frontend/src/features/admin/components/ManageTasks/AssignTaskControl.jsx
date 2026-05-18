import { useState } from 'react';
import toast from 'react-hot-toast';
import Select from '../../../../components/Select';
import Button from '../../../../components/Button';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import {
  assignAdminTask,
  useAdminTaskAssigneesStore,
} from '../../../../store/admin/useAdminTasksStore';
import useAdminAuthStore from '../../../../store/useAdminAuthStore';
import { canManageTaskAssignment } from '../../../../constants/staffRoles';
import { isOpenTask } from './taskUtils';

const AssignTaskControl = ({ task, onAssigned, compact = false }) => {
  const { admin } = useAdminAuthStore();
  const [assigneeId, setAssigneeId] = useState('');
  const [loading, setLoading] = useState(false);

  const { data } = useCachedQuery(
    useAdminTaskAssigneesStore,
    'admin-task-assignees',
    {},
    { enabled: canManageTaskAssignment(admin?.role) },
  );
  const assignees = Array.isArray(data) ? data : [];

  if (!canManageTaskAssignment(admin?.role) || !task || !isOpenTask(task)) return null;

  const options = assignees.map((u) => ({
    value: u._id,
    label: `${u.name || u.email}${u.role === 'admin' ? ' (Super Admin)' : u.role === 'sub_admin' ? ' (Sub Admin)' : ''}`,
  }));

  const handleAssign = async () => {
    if (!assigneeId) {
      toast.error('Select a team member');
      return;
    }
    setLoading(true);
    try {
      await assignAdminTask(task._id, { assigneeId });
      toast.success('Task assigned');
      onAssigned?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-[200px]">
        <Select
          value={assigneeId}
          onChange={setAssigneeId}
          placeholder="Assign to…"
          options={[{ value: '', label: 'Select member' }, ...options]}
          className="flex-1"
        />
        <Button variant="outline" size="sm" loading={loading} onClick={handleAssign}>
          Assign
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="flex-1">
        <Select
          value={assigneeId}
          onChange={setAssigneeId}
          placeholder="Select team member"
          options={[{ value: '', label: 'Select member' }, ...options]}
        />
      </div>
      <Button variant="admin" size="md" loading={loading} onClick={handleAssign}>
        Assign task
      </Button>
    </div>
  );
};

export default AssignTaskControl;
