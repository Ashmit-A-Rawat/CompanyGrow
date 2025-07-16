import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, LogIn, UserPlus, User, Phone, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './login.css';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ 
    email: '', 
    password: '',
    name: '',
    phone: '',
    confirmPassword: '',
    experience: '',
    skills: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const resetForm = () => {
    setForm({ 
      email: '', 
      password: '',
      name: '',
      phone: '',
      confirmPassword: '',
      experience: '',
      skills: ''
    });
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  const loginUser = async (userData) => {
    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid server response');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    return data;
  };

  const signupUser = async (userData) => {
    const response = await fetch('http://localhost:4000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid server response');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Signup failed');
    }

    return data;
  };

  const validateLoginForm = () => {
    const newErrors = {};
    if (!form.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Email is invalid';

    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignupForm = () => {
    const newErrors = {};
    
    if (!form.name) newErrors.name = 'Full name is required';
    else if (form.name.length < 2) newErrors.name = 'Name must be at least 2 characters';

    if (!form.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Email is invalid';

    if (!form.phone) newErrors.phone = 'Phone number is required';
    else if (!/^\d{10,}$/.test(form.phone.replace(/\D/g, ''))) newErrors.phone = 'Phone number must be at least 10 digits';

    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (!form.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    if (!form.experience) newErrors.experience = 'Experience is required';
    else if (isNaN(form.experience) || form.experience < 0) newErrors.experience = 'Experience must be a valid number';

    if (!form.skills) newErrors.skills = 'At least one skill is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const isValid = isLogin ? validateLoginForm() : validateSignupForm();
    if (!isValid) return;
    
    setIsLoading(true);
    setErrors({});

    try {
      let res;
      
      if (isLogin) {
        res = await loginUser({ email: form.email, password: form.password });
        console.log("Login response from server:", res);

        // Store token and user info
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify({
          id: res._id,
          name: res.name,
          email: res.email,
          role: res.role
        }));
        localStorage.setItem('role', res.role);
        localStorage.setItem('name', res.name);
        localStorage.setItem('id', res._id);
        
        navigate('/dashboard');
      } else {
        // Prepare signup data
        const signupData = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          experience: parseInt(form.experience),
          skills: form.skills.split(',').map(skill => skill.trim()).filter(skill => skill)
        };

        res = await signupUser(signupData);
        console.log("Signup response from server:", res);

        // Auto-login after successful signup
        if (res.token) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify({
            id: res._id,
            name: res.name,
            email: res.email,
            role: res.role
          }));
          localStorage.setItem('role', res.role);
          localStorage.setItem('name', res.name);
          localStorage.setItem('id', res._id);
          
          navigate('/dashboard');
        } else {
          // If no auto-login, switch to login mode
          setIsLogin(true);
          resetForm();
          setErrors({ general: 'Account created successfully! Please login.' });
        }
      }
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: '' });
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className={`login-box ${!isLogin ? 'signup-mode' : ''}`}>
        <div className="login-header">
          <div className="login-icon">
            {isLogin ? <LogIn size={32} /> : <UserPlus size={32} />}
          </div>
          <h1>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
          <p>{isLogin ? 'Sign in to your account to continue' : 'Join our team and start your journey'}</p>
        </div>

        {errors.general && <div className="error-message">{errors.general}</div>}

        {/* Signup-only fields */}
        {!isLogin && (
          <>
            <div className="input-group">
              <label>Full Name</label>
              <div className="input-wrapper">
                <User className="input-icon" />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={isLoading}
                  className={errors.name ? 'input error' : 'input'}
                />
              </div>
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>

            <div className="input-group">
              <label>Phone Number</label>
              <div className="input-wrapper">
                <Phone className="input-icon" />
                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={form.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={isLoading}
                  className={errors.phone ? 'input error' : 'input'}
                />
              </div>
              {errors.phone && <p className="field-error">{errors.phone}</p>}
            </div>
          </>
        )}

        {/* Common fields */}
        <div className="input-group">
          <label>Email Address</label>
          <div className="input-wrapper">
            <Mail className="input-icon" />
            <input
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={isLoading}
              className={errors.email ? 'input error' : 'input'}
            />
          </div>
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div className="input-group">
          <label>Password</label>
          <div className="input-wrapper">
            <Lock className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              disabled={isLoading}
              className={errors.password ? 'input error' : 'input'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="toggle-password"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>

        {/* Signup-only fields continued */}
        {!isLogin && (
          <>
            <div className="input-group">
              <label>Confirm Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  disabled={isLoading}
                  className={errors.confirmPassword ? 'input error' : 'input'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="toggle-password"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
            </div>

            <div className="input-group">
              <label>Years of Experience</label>
              <div className="input-wrapper">
                <Briefcase className="input-icon" />
                <input
                  type="number"
                  min="0"
                  placeholder="Enter years of experience"
                  value={form.experience}
                  onChange={(e) => handleInputChange('experience', e.target.value)}
                  disabled={isLoading}
                  className={errors.experience ? 'input error' : 'input'}
                />
              </div>
              {errors.experience && <p className="field-error">{errors.experience}</p>}
            </div>

            <div className="input-group">
              <label>Skills</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="Enter skills separated by commas (e.g., JavaScript, React, Node.js)"
                  value={form.skills}
                  onChange={(e) => handleInputChange('skills', e.target.value)}
                  disabled={isLoading}
                  className={errors.skills ? 'input error skills-input' : 'input skills-input'}
                />
              </div>
              {errors.skills && <p className="field-error">{errors.skills}</p>}
            </div>
          </>
        )}

        {/* Login-only options */}
        {isLogin && (
          <div className="options">
            <label>
              <input type="checkbox" /> Remember me
            </label>
            <button type="button" className="forgot-password">Forgot password?</button>
          </div>
        )}

        <button type="submit" className="submit-btn" disabled={isLoading}>
          {isLoading ? (isLogin ? 'Signing In...' : 'Creating Account...') : (
            <div className="btn-flex">
              {isLogin ? <LogIn className="btn-icon" /> : <UserPlus className="btn-icon" />}
              {isLogin ? 'Sign In' : 'Create Account'}
            </div>
          )}
        </button>

        {/* Mode toggle */}
        <div className="mode-toggle">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button" 
              className="toggle-link" 
              onClick={toggleMode}
              disabled={isLoading}
            >
              {isLogin ? 'Sign up here' : 'Sign in here'}
            </button>
          </p>
        </div>

        <p className="footer">© 2024 Your Company. All rights reserved.</p>
      </form>
    </div>
  );
}