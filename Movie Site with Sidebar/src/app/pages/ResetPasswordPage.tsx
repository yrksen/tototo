import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectId, publicAnonKey } from '/utils/supabase/info';
const logoImage = 'https://i.imgur.com/vUiVqow.png?direct';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

interface ResetPasswordPageProps {
  isDarkMode: boolean;
}

export function ResetPasswordPage({ isDarkMode }: ResetPasswordPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Extract email from URL hash or query params (Supabase auth redirects with hash)
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get('access_token');
    
    // If there's an access token, we can extract the user email
    // For now, we'll ask the user to enter their email
    // In a production setup, you'd verify the token with Supabase
    
    console.log('Reset password page loaded', { hash, accessToken });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          newPassword,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
        return;
      }
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`w-full max-w-md rounded-lg shadow-xl p-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={logoImage} alt="Trash Bin Logo" className="size-12" />
        </div>
        
        <h1 className={`text-2xl font-bold text-center mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
          Reset Password
        </h1>
        
        <p className={`text-center mb-6 text-[13px] ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Enter your email and new password below
        </p>
        
        {success ? (
          <div className={`p-4 rounded-lg text-center ${isDarkMode ? 'bg-green-900/50 text-green-200' : 'bg-green-50 text-green-800'}`}>
            <p className="font-medium mb-1">Password reset successful!</p>
            <p className="text-[13px]">Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`p-3 rounded-lg text-[13px] ${isDarkMode ? 'bg-red-900/50 text-red-200' : 'bg-red-50 text-red-800'}`}>
                {error}
              </div>
            )}
            
            <div>
              <label 
                htmlFor="email" 
                className={`block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Email Address
              </label>
              <input
                id="email"
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
                htmlFor="new-password" 
                className={`block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
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
                htmlFor="confirm-password" 
                className={`block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                className={`w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-black placeholder-gray-500'
                }`}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full px-4 py-2.5 text-[13px] font-medium rounded-lg transition-opacity ${
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
              } ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/')}
              className={`w-full text-[13px] hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
            >
              Back to home
            </button>
          </form>
        )}
      </div>
    </div>
  );
}