
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType, LoginLog } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default super admin user
const defaultSuperAdmin: User = {
  id: 'SA-001',
  name: 'Muhammad Umar',
  email: 'umaridmpaksitan@gmail.com',
  role: 'SuperAdmin',
  createdAt: new Date().toISOString(),
  lastLogin: undefined
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // For now, only allow the super admin to login
    if (email === 'umaridmpaksitan@gmail.com' && password === 'admin123') {
      const loginTime = new Date().toISOString();
      const updatedUser = { 
        ...defaultSuperAdmin, 
        lastLogin: loginTime 
      };
      
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      // Log the login
      const loginLog: LoginLog = {
        id: `LOG-${Date.now()}`,
        userId: updatedUser.id,
        loginTime,
      };
      
      const existingLogs = JSON.parse(localStorage.getItem('loginLogs') || '[]');
      existingLogs.push(loginLog);
      localStorage.setItem('loginLogs', JSON.stringify(existingLogs));
      
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    if (user) {
      const logoutTime = new Date().toISOString();
      
      // Update the latest login log with logout time
      const existingLogs: LoginLog[] = JSON.parse(localStorage.getItem('loginLogs') || '[]');
      const latestLog = existingLogs.find(log => log.userId === user.id && !log.logoutTime);
      
      if (latestLog) {
        latestLog.logoutTime = logoutTime;
        latestLog.sessionDuration = new Date(logoutTime).getTime() - new Date(latestLog.loginTime).getTime();
        localStorage.setItem('loginLogs', JSON.stringify(existingLogs));
      }
    }
    
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
