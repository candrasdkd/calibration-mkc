export type EditableSection = 'identity' | 'environment' | 'references' | 'safety';
export type FieldUpdate = (section: EditableSection, key: string, value: string | boolean) => void;
export type InspectionUpdate = (index: number, key: 'physical' | 'function' | 'note', value: string) => void;
export type PerformanceUpdate = (index: number, key: 'setting' | 'readings', value: string, readingIndex?: number) => void;
