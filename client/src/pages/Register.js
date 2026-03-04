import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';
import { API_BASE_URL } from '../config';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
    caregiverId: ''
  });
  const [caregivers, setCaregivers] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch caregivers for dropdown
    const fetchCaregivers = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/caregivers`);
        setCaregivers(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCaregivers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/register`, formData);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      if (res.data.user.role === 'patient') {
        navigate('/patient');
      } else {
        navigate('/caregiver');
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>reminiscence.ai</h1>
        <h2>Register</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
          <select
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
          >
            <option value="patient">Patient</option>
            <option value="caregiver">Caregiver</option>
          </select>
          
          {formData.role === 'patient' && (
            <select
              value={formData.caregiverId}
              onChange={(e) => setFormData({...formData, caregiverId: e.target.value})}
              required
            >
              <option value="">Select Caregiver</option>
              {caregivers.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          )}
          
          <button type="submit">Register</button>
        </form>
        <p>Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
};

export default Register;