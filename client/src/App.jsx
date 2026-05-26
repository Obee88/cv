import { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage.jsx';
import CVEditor from './components/CVEditor.jsx';

export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token');
    const email = localStorage.getItem('email');
    return token ? { token, email } : null;
  });

  function handleLogin(token, email) {
    localStorage.setItem('token', token);
    localStorage.setItem('email', email);
    setAuth({ token, email });
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setAuth(null);
  }

  if (!auth) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return <CVEditor token={auth.token} email={auth.email} onLogout={handleLogout} />;
}
