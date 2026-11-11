import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  Mail,
  KeyRound,
  ShieldCheck,
  X,
  AlertCircle,
  CheckCircle2,
  LogIn,
  UserPlus,
  Sparkles,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';
import { buildApiUrl } from '../../config/api.js';

export const AdminAuthModal = ({
  isOpen,
  onClose,
  showToast,
  initialMode = 'login',
}) => {
  const {
    dbUser,
    registerAdmin,
    loginWithPassword,
    changePassword,
    resetPassword,
    loginWithGoogle,
    isSigningIn,
    setDevAdminBypass,
  } = usePortfolioBackend();

  // Mode: 'login' | 'register' | 'change' | 'forgot'
  const [authMode, setAuthMode] = useState(initialMode);

  // Sync mode whenever modal opens with a specific requested mode
  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode || 'login');
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [isOpen, initialMode]);

  // Form states
  const [loginForm, setLoginForm] = useState({
    identifier: '',
    password: '',
  });

  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    confirmPassword: '',
  });

  const [changeForm, setChangeForm] = useState({
    identifier: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const [forgotForm, setForgotForm] = useState({
    identifier: '',
    email: '',
    recoveryKey: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // 1. Submit Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginForm.identifier.trim() || !loginForm.password) {
      setErrorMessage('Please fill in both your username/email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginWithPassword({
        identifier: loginForm.identifier.trim(),
        password: loginForm.password,
      });

      if (result.success) {
        setSuccessMessage(result.message || 'Logged in successfully!');
        showToast?.(`Welcome back, ${result.user?.username || 'Admin'}!`);
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        setErrorMessage(result.error || 'Invalid username or password.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Submit Register
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const { username, email, fullName, password, confirmPassword } = registerForm;

    if (!username.trim() || !email.trim() || !password) {
      setErrorMessage('Username, email, and password are required.');
      return;
    }

    if (username.trim().length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerAdmin({
        username: username.trim(),
        email: email.trim(),
        fullName: fullName.trim() || username.trim(),
        password,
      });

      if (result.success) {
        setSuccessMessage('Admin account registered and saved to MongoDB!');
        showToast?.(`Admin user @${username} created and logged in!`);
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setErrorMessage(result.error || 'Registration failed.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Registration error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Submit Change Password
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const { identifier, currentPassword, newPassword, confirmNewPassword } = changeForm;
    const targetUser = identifier.trim() || dbUser?.username || 'admin';

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await changePassword({
        identifier: targetUser,
        currentPassword,
        newPassword,
      });

      if (result.success) {
        setSuccessMessage(result.message || 'Password updated successfully!');
        showToast?.('Password updated successfully!');
        setTimeout(() => {
          setAuthMode('login');
          setLoginForm((prev) => ({ ...prev, identifier: targetUser, password: newPassword }));
        }, 900);
      } else {
        setErrorMessage(result.error || 'Failed to update password.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Password change error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Submit Forgot / Reset Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const { identifier, email, recoveryKey, newPassword, confirmNewPassword } = forgotForm;

    if (!identifier.trim() && !email.trim()) {
      setErrorMessage('Please provide your username or registered email address.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword({
        identifier: identifier.trim(),
        email: email.trim(),
        recoveryKey: recoveryKey.trim() || 'sachin2026',
        newPassword,
      });

      if (result.success) {
        setSuccessMessage(result.message || 'Password reset successfully!');
        showToast?.('Password reset successful! Please log in.');
        setTimeout(() => {
          setAuthMode('login');
          setLoginForm({
            identifier: identifier.trim() || email.trim(),
            password: newPassword,
          });
        }, 1200);
      } else {
        setErrorMessage(result.error || 'Verification failed. Could not reset password.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Password reset error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleLogin = async () => {
    setErrorMessage('');
    const res = await loginWithGoogle();
    if (res?.success) {
      showToast?.('Signed in with Google!');
      onClose();
    } else if (res?.cancelled) {
      setErrorMessage('Popup closed or cancelled. Use Username/Password or Master Access.');
    } else if (res?.error) {
      setErrorMessage(res.error);
    }
  };

  // Master Access One-Click Bypass
  const handleMasterBypass = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/auth/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: 'admin123' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('portfolio_admin_token', data.token);
        }
        if (data.user) {
          localStorage.setItem('portfolio_admin_user', JSON.stringify(data.user));
        }
      } else {
        localStorage.setItem('portfolio_admin_token', 'master_bypass_session_active');
      }
    } catch {
      localStorage.setItem('portfolio_admin_token', 'master_bypass_session_active');
    }
    setDevAdminBypass(true);
    showToast?.('Master Admin Access Enabled!');
    onClose();
  };

  return (
    <div className="admin-auth-modal-overlay" onClick={onClose}>
      <div
        className="admin-auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="admin-auth-modal-header">
          <div className="auth-header-title-row">
            <span className="auth-brand-badge">
              <ShieldCheck size={20} className="text-cyan-400" />
            </span>
            <div>
              <h3 className="auth-modal-title">
                {authMode === 'login' && 'Admin Sign In'}
                {authMode === 'register' && 'Register New Admin'}
                {authMode === 'change' && 'Change Admin Password'}
                {authMode === 'forgot' && 'Reset / Forgot Password'}
              </h3>
              <p className="auth-modal-sub">
                MongoDB Database Verified Access & Management
              </p>
            </div>
          </div>
          <button
            type="button"
            className="auth-modal-close-btn"
            onClick={onClose}
            aria-label="Close auth dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tab-nav">
          <button
            type="button"
            className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('login');
              setErrorMessage('');
              setSuccessMessage('');
            }}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('register');
              setErrorMessage('');
              setSuccessMessage('');
            }}
          >
            <UserPlus size={15} />
            <span>Register</span>
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${authMode === 'change' || authMode === 'forgot' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode(dbUser ? 'change' : 'forgot');
              setErrorMessage('');
              setSuccessMessage('');
            }}
          >
            <KeyRound size={15} />
            <span>{dbUser ? 'Change Pwd' : 'Reset Pwd'}</span>
          </button>
        </div>

        {/* Alert Notifications */}
        {errorMessage && (
          <div className="auth-alert-box error">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="auth-alert-box success">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="auth-form-body">
            <div className="auth-form-field">
              <label htmlFor="login-identifier">Username or Email</label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-input-icon" />
                <input
                  id="login-identifier"
                  type="text"
                  placeholder="e.g. admin or sachinkumar.gheura@gmail.com"
                  value={loginForm.identifier}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, identifier: e.target.value })
                  }
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-form-field">
              <div className="field-label-with-action">
                <label htmlFor="login-password">Password</label>
                <button
                  type="button"
                  className="btn-forgot-password-link"
                  onClick={() => {
                    setAuthMode('forgot');
                    setForgotForm((prev) => ({
                      ...prev,
                      identifier: loginForm.identifier,
                    }));
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="auth-input-wrapper">
                <KeyRound size={16} className="auth-input-icon" />
                <input
                  id="login-password"
                  type="password"
                  placeholder="Enter your admin password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="auth-field-hint">
                Pre-seeded admin: <code>admin</code> / <code>admin123</code>
              </div>
            </div>

            <button
              type="submit"
              className="btn-auth-submit primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Verifying Credentials...
                </>
              ) : (
                <>
                  <LogIn size={16} /> Sign In with Database
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. REGISTER FORM */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="auth-form-body">
            <div className="auth-form-row">
              <div className="auth-form-field">
                <label htmlFor="reg-username">Username</label>
                <div className="auth-input-wrapper">
                  <User size={16} className="auth-input-icon" />
                  <input
                    id="reg-username"
                    type="text"
                    placeholder="e.g. sachin_admin"
                    value={registerForm.username}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, username: e.target.value })
                    }
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="auth-form-field">
                <label htmlFor="reg-name">Full Name</label>
                <div className="auth-input-wrapper">
                  <Sparkles size={16} className="auth-input-icon" />
                  <input
                    id="reg-name"
                    type="text"
                    placeholder="e.g. Sachin Kumar"
                    value={registerForm.fullName}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, fullName: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="auth-form-field">
              <label htmlFor="reg-email">Email Address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="reg-email"
                  type="email"
                  placeholder="e.g. sachinkumar.gheura@gmail.com"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-form-row">
              <div className="auth-form-field">
                <label htmlFor="reg-password">Password</label>
                <div className="auth-input-wrapper">
                  <KeyRound size={16} className="auth-input-icon" />
                  <input
                    id="reg-password"
                    type="password"
                    placeholder="Min 6 characters"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, password: e.target.value })
                    }
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className="auth-form-field">
                <label htmlFor="reg-confirm">Confirm Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    id="reg-confirm"
                    type="password"
                    placeholder="Re-enter password"
                    value={registerForm.confirmPassword}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-auth-submit primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Saving to MongoDB...
                </>
              ) : (
                <>
                  <UserPlus size={16} /> Register Admin & Save to Database
                </>
              )}
            </button>
          </form>
        )}

        {/* 3. CHANGE PASSWORD FORM */}
        {authMode === 'change' && (
          <form onSubmit={handleChangePasswordSubmit} className="auth-form-body">
            <div className="auth-form-field">
              <label htmlFor="chg-identifier">Username</label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-input-icon" />
                <input
                  id="chg-identifier"
                  type="text"
                  placeholder="e.g. admin or your username"
                  value={changeForm.identifier || dbUser?.username || 'admin'}
                  onChange={(e) =>
                    setChangeForm({ ...changeForm, identifier: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="auth-form-field">
              <label htmlFor="chg-current">Current Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="chg-current"
                  type="password"
                  placeholder="Enter your current password"
                  value={changeForm.currentPassword}
                  onChange={(e) =>
                    setChangeForm({ ...changeForm, currentPassword: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="auth-form-row">
              <div className="auth-form-field">
                <label htmlFor="chg-new">New Password</label>
                <div className="auth-input-wrapper">
                  <KeyRound size={16} className="auth-input-icon" />
                  <input
                    id="chg-new"
                    type="password"
                    placeholder="Min 6 characters"
                    value={changeForm.newPassword}
                    onChange={(e) =>
                      setChangeForm({ ...changeForm, newPassword: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="auth-form-field">
                <label htmlFor="chg-confirm">Confirm New Password</label>
                <div className="auth-input-wrapper">
                  <KeyRound size={16} className="auth-input-icon" />
                  <input
                    id="chg-confirm"
                    type="password"
                    placeholder="Re-enter new password"
                    value={changeForm.confirmNewPassword}
                    onChange={(e) =>
                      setChangeForm({
                        ...changeForm,
                        confirmNewPassword: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-auth-submit primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Updating Password...
                </>
              ) : (
                <>
                  <KeyRound size={16} /> Update Password in MongoDB
                </>
              )}
            </button>
          </form>
        )}

        {/* 4. FORGOT / RESET PASSWORD FORM */}
        {authMode === 'forgot' && (
          <form onSubmit={handleResetPasswordSubmit} className="auth-form-body">
            <div className="auth-info-banner">
              <HelpCircle size={16} className="text-cyan-400" />
              <span>
                Verify your registered username & email, or use the master recovery passcode (<code>sachin2026</code>) to set a new password.
              </span>
            </div>

            <div className="auth-form-field">
              <label htmlFor="rst-user">Username</label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-input-icon" />
                <input
                  id="rst-user"
                  type="text"
                  placeholder="e.g. admin or your username"
                  value={forgotForm.identifier}
                  onChange={(e) =>
                    setForgotForm({ ...forgotForm, identifier: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="auth-form-field">
              <label htmlFor="rst-email">Registered Email</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="rst-email"
                  type="email"
                  placeholder="e.g. sachinkumar.gheura@gmail.com"
                  value={forgotForm.email}
                  onChange={(e) =>
                    setForgotForm({ ...forgotForm, email: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="auth-form-row">
              <div className="auth-form-field">
                <label htmlFor="rst-new">New Password</label>
                <div className="auth-input-wrapper">
                  <KeyRound size={16} className="auth-input-icon" />
                  <input
                    id="rst-new"
                    type="password"
                    placeholder="Min 6 characters"
                    value={forgotForm.newPassword}
                    onChange={(e) =>
                      setForgotForm({ ...forgotForm, newPassword: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="auth-form-field">
                <label htmlFor="rst-confirm">Confirm Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    id="rst-confirm"
                    type="password"
                    placeholder="Re-enter password"
                    value={forgotForm.confirmNewPassword}
                    onChange={(e) =>
                      setForgotForm({
                        ...forgotForm,
                        confirmNewPassword: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-auth-submit primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Resetting Password...
                </>
              ) : (
                <>
                  <RotateCcw size={16} /> Reset Password & Save to MongoDB
                </>
              )}
            </button>
          </form>
        )}

        {/* Alternative Auth Methods */}
        <div className="auth-divider">
          <span>OR SIGN IN WITH GOOGLE</span>
        </div>

        <div className="auth-secondary-actions" style={{ gridTemplateColumns: '1fr' }}>
          <button
            type="button"
            className="btn-auth-secondary google"
            disabled={isSigningIn}
            onClick={handleGoogleLogin}
            title="Sign in with your Google Admin account"
          >
            <i className={isSigningIn ? 'fas fa-spinner fa-spin' : 'fab fa-google'} />
            <span>Sign In with Google ({'sachinkumar.gheura@gmail.com'})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
