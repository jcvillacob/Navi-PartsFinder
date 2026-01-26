export type UserRole = 'admin' | 'importer' | 'viewer';

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}
