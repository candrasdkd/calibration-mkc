import { useContext } from 'react';
import { AdminDataContext } from '../../../core/admin-data';

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) throw new Error('useAdminData harus digunakan di dalam AdminDataProvider.');
  return context;
}
