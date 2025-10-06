
export type UserRole = 
  | 'owner' 
  | 'store_manager' 
  | 'dispatch_manager' 
  | 'returns_manager' 
  | 'staff'
  | 'SuperAdmin' 
  | 'Manager' 
  | 'Dispatch/Returns Manager'; // Legacy roles for backward compatibility

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
