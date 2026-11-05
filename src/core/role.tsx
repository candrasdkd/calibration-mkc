import React, { createContext, useState, type PropsWithChildren } from 'react';

export type Role = 'admin' | 'technician';
export type RoleContextValue = { role: Role; setRole: (role: Role) => void };
export const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: PropsWithChildren) {
  const [role, setRole] = useState<Role>('admin');
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

