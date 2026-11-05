import { useEffect, useState } from 'react';
import type { RegionOption } from '../types/RegionOption';

const regionApi = 'https://www.emsifa.com/api-wilayah-indonesia/v2';
async function fetchRegions(path: string): Promise<RegionOption[]> {
  const response = await fetch(`${regionApi}/${path}`);
  if (!response.ok) throw new Error('Permintaan data wilayah gagal.');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) throw new Error('Format data wilayah tidak sesuai.');
  return (payload as { data: unknown[] }).data.flatMap((item): RegionOption[] => {
    if (!item || typeof item !== 'object') return [];
    const region = item as Record<string, unknown>;
    return typeof region.id === 'string' && typeof region.name === 'string' ? [{ id: region.id, name: region.name }] : [];
  });
}
export function useRegionOptions(path: string | null) {
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState<{ path: string; retryKey: number; options: RegionOption[]; error: string }>({ path: '', retryKey: -1, options: [], error: '' });

  useEffect(() => {
    if (!path) return undefined;
    let active = true;
    fetchRegions(path)
      .then((items) => { if (active) setResult({ path, retryKey, options: items, error: '' }); })
      .catch(() => { if (active) setResult({ path, retryKey, options: [], error: 'Data wilayah gagal dimuat. Periksa koneksi lalu coba lagi.' }); });
    return () => { active = false; };
  }, [path, retryKey]);

  const retry = () => setRetryKey((value) => value + 1);
  if (!path) return { options: [], loading: false, error: '', retry };
  const current = result.path === path && result.retryKey === retryKey;
  return { options: current ? result.options : [], loading: !current, error: current ? result.error : '', retry };
}
