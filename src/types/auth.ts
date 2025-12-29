
export type UserRole = 
  | 'super_admin'
  | 'super_manager'
  | 'warehouse_manager'
  | 'store_manager'
  | 'dispatch_manager'
  | 'returns_manager'
  | 'staff'
  | 'senior_staff'
  | 'supplier'
  | 'finance';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
}

export interface LoginLog {
  id: string;
  userId: string;
  loginTime: string;
  logoutTime?: string;
  sessionDuration?: number;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}
