import { useContext } from 'react';
import { RoleContext } from '../../../core/role';

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole harus digunakan di dalam RoleProvider.');
  return context;
}
