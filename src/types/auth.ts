
export type UserRole = 'Owner/SuperAdmin' | 'Store Manager' | 'Dispatch Manager' | 'Returns Manager' | 'Staff';

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
