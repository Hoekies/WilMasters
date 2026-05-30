'use client';

import { useEffect, useState } from 'react';

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'laanderhof';
export const AUTH_KEY = 'wm_admin';

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { setIsAdmin(localStorage.getItem(AUTH_KEY) === '1'); }, []);
  const login = (u: string, p: string) => {
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      localStorage.setItem(AUTH_KEY, '1');
      setIsAdmin(true);
      return true;
    }
    return false;
  };
  const logout = () => { localStorage.removeItem(AUTH_KEY); setIsAdmin(false); };
  return { isAdmin, login, logout };
}
