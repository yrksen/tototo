import { X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  setCurrentUser?: (user: any) => void;
}

type ModalView = 'login' | 'create-account' | 'forgot-password';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

export function LoginModal({ isOpen, onClose, isDarkMode, setCurrentUser }: LoginModalProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<ModalView>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setView('login');
    setUsername('');
    setEmail('');
    setPassword('');
    setError('');
    setSuccessMessage('');
    onClose();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      
      // Store user data in localStorage
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      
      if (setCurrentUser) {
        setCurrentUser(data.user);
      }
      handleClose();
      navigate('/profile');
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ username, email, password }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Account creation failed');
        setLoading(false);
        return;
      }
      
      // Store user data in localStorage
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      
      if (setCurrentUser) {
        setCurrentUser(data.user);
      }
      handleClose();
      navigate('/profile');
    } catch (err) {
      console.error('Signup error:', err);
      setError('An error occurred during account creation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Password reset failed');
        setLoading(false);
        return;
      }
      
      setSuccessMessage(data.message);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (view) {
      case 'create-account':
        return 'Create account';
      case 'forgot-password':
        return 'Reset password';
      default:
        return 'Sign in';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-lg shadow-xl ${isDarkMode ? 'bg-gray-800' : 'bg-background'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>
            {getTitle()}
          </h2>
          <button
            onClick={handleClose}
            className={`hover:opacity-70 transition-opacity ${isDarkMode ? 'text-white' : 'text-black'}`}
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Login View */}
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
            {error && (
              <div className={`p-3 rounded-lg text-[13px] ${isDarkMode ? 'bg-red-900/50 text-red-200' : 'bg-red-50 text-red-800'}`}>
                {error}
              </div>
            )}
            
            <div>
              <label 
                htmlFor="login-username" 
                className={`block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className={`w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-black placeholder-gray-500'
                }`}
              />
            </div>

            <div>
              <label 
                htmlFor="login-password" 
                className={`block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className={`w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-black placeholder-gray-500'
                }`}
              />
            </div>

            {/* Forgot Password & Create Account Links */}
            <div className="flex items-center justify-between text-[13px]">
              <button
                type="button"
                onClick={() => setView('forgot-password')}
                className={`hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => setView('create-account')}
                className={`hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Create account
              </button>
            </div>

            <button
              type="submit"
              className={`w-full px-4 py-2.5 text-[13px] font-medium rounded-lg transition-opacity hover:opacity-90 ${
                isDarkMode ? 'bg-white text-black' : 'bg-black text-white'
              }`}
            >
              Sign in
            </button>
          </form>
        )}

        {/* Create Account View */}
        {view === 'create-account' && (
          <form onSubmit={handleCreateAccountSubmit} className="p-6 space-y-4">
            {error && (
              <div className={`p-3 rounded-lg text-[13px] ${isDarkMode ? 'bg-red-900/50 text-red-200' : 'bg-red-50 text-red-800'}`}>
                {error}
              </div>
            )}
            
            <div>
              <label 
                htmlFor="create-username" 
                className={`block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Username
              </label>
              <input
                id="create-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                className={`w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-black placeholder-gray-500'
                }`}
              />
            </div>

            <div>
              <label 
                htmlFor="create-email" 
                className={`block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Email
              </label>
              <input
                id="create-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className={`w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-black placeholder-gray-500'
                }`}
              />
            </div>

            <div>
              <label 
                htmlFor="create-password" 
                className={`block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Password
              </label>
              <input
                id="create-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                className={`w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-black placeholder-gray-500'
                }`}
              />
            </div>

            {/* Back to Sign in Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setView('login')}
                className={`text-[13px] hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Already have an account? Sign in
              </button>
            </div>

            <button
              type="submit"
              className={`w-full px-4 py-2.5 text-[13px] font-medium rounded-lg transition-opacity hover:opacity-90 ${
                isDarkMode ? 'bg-white text-black' : 'bg-black text-white'
              }`}
            >
              Create account
            </button>
          </form>
        )}

        {/* Forgot Password View */}
        {view === 'forgot-password' && (
          <form onSubmit={handleForgotPasswordSubmit} className="p-6 space-y-4">
            {error && (
              <div className={`p-3 rounded-lg text-[13px] ${isDarkMode ? 'bg-red-900/50 text-red-200' : 'bg-red-50 text-red-800'}`}>
                {error}
              </div>
            )}
            
            {successMessage && (
              <div className={`p-3 rounded-lg text-[13px] ${isDarkMode ? 'bg-green-900/50 text-green-200' : 'bg-green-50 text-green-800'}`}>
                {successMessage}
              </div>
            )}
            
            <p className={`text-[13px] mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div>
              <label 
                htmlFor="forgot-email" 
                className={`block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className={`w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-black placeholder-gray-500'
                }`}
              />
            </div>

            {/* Back to Sign in Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setView('login')}
                className={`text-[13px] hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Back to sign in
              </button>
            </div>

            <button
              type="submit"
              className={`w-full px-4 py-2.5 text-[13px] font-medium rounded-lg transition-opacity hover:opacity-90 ${
                isDarkMode ? 'bg-white text-black' : 'bg-black text-white'
              }`}
            >
              Send reset link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}