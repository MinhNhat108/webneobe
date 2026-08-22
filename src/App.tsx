import { useState, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { PasswordGate } from './components/auth/PasswordGate';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('mooring_app_auth') === 'true';
  });

  useEffect(() => {
    const auth = localStorage.getItem('mooring_app_auth') === 'true';
    setIsAuthenticated(auth);
  }, []);

  const handleUnlock = () => {
    setIsAuthenticated(true);
  };

  const handleLock = () => {
    localStorage.removeItem('mooring_app_auth');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <PasswordGate onUnlock={handleUnlock} />;
  }

  return <AppShell onLock={handleLock} />;
}

export default App;
