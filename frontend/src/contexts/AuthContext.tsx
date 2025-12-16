import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'facebook';
  credits: number;
  dailyCredits: number;
  rolloverCap: number;
  plan: string;
  hasCompletedOnboarding: boolean;
  facebookConnected: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (provider: 'google' | 'facebook') => Promise<void>;
  logout: () => void;
  completeOnboarding: () => void;
  claimBonusCredits: () => void;
  updateCredits: (amount: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'vibelets_user';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const saveUser = (userData: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const login = async (provider: 'google' | 'facebook') => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockUser: User = {
      id: `user_${Date.now()}`,
      name: provider === 'google' ? 'Alex Johnson' : 'Alex Johnson',
      email: provider === 'google' ? 'alex@gmail.com' : 'alex@facebook.com',
      avatar: undefined,
      provider,
      credits: 5,
      dailyCredits: 5,
      rolloverCap: 30,
      plan: 'Free Forever',
      hasCompletedOnboarding: false,
      facebookConnected: provider === 'facebook',
    };
    
    saveUser(mockUser);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const completeOnboarding = () => {
    if (user) {
      const updated = { ...user, hasCompletedOnboarding: true };
      saveUser(updated);
    }
  };

  const claimBonusCredits = () => {
    if (user) {
      const updated = { ...user, credits: user.credits + 500 };
      saveUser(updated);
    }
  };

  const updateCredits = (amount: number) => {
    if (user) {
      const updated = { ...user, credits: Math.max(0, user.credits + amount) };
      saveUser(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        completeOnboarding,
        claimBonusCredits,
        updateCredits,
      }}
    >
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
