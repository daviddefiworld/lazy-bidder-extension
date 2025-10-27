import React, { useState } from 'react';
import { RegisterProps } from '../types/sidebar';

const Register: React.FC<RegisterProps> = ({ onRegister, onBackToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await onRegister(name, email, password, confirmPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">Register</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-input-group">
          <label htmlFor="name" className="auth-label">
            Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input"
            placeholder="Enter your full name"
            required
          />
        </div>
        <div className="auth-input-group">
          <label htmlFor="email" className="auth-label">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            placeholder="Enter your email"
            required
          />
        </div>
        <div className="auth-input-group">
          <label htmlFor="password" className="auth-label">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            placeholder="Enter your password"
            required
          />
        </div>
        <div className="auth-input-group">
          <label htmlFor="confirmPassword" className="auth-label">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="auth-input"
            placeholder="Confirm your password"
            required
          />
        </div>
        {error && (
          <div className="auth-error">{error}</div>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="auth-button"
        >
          {isLoading ? 'Registering...' : 'Register'}
        </button>
      </form>
      <div className="mt-6 text-center">
        <button
          onClick={onBackToLogin}
          className="auth-link"
        >
          Already have an account? Login
        </button>
      </div>
    </div>
  );
};

export default Register;
