import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMe, signout as apiSignout } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // true while restoring session

  // Restore session from httpOnly cookie on mount
  useEffect(() => {
    getMe()
      .then((res) => setUser(res.data || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signout = async () => {
    await apiSignout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, signout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
