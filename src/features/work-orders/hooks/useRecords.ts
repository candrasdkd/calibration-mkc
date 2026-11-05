import { useContext } from 'react';
import { RecordsContext, type RecordsContextValue } from '../../../core/records';

export function useRecords(): RecordsContextValue {
  const context = useContext(RecordsContext);
  if (!context) throw new Error('useRecords harus digunakan di dalam RecordsProvider.');
  return context;
}
