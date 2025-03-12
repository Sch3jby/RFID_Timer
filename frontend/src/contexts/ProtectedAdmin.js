import React, { useState, useEffect } from 'react';
import axios from '../api/axiosConfig';
import { Navigate, useNavigate } from 'react-router-dom';

const ProtectedAdmin = ({ children }) => {
  const [isAuthorized, setIsAuthorized] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const checkAuthorization = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsAuthorized(false);
        return;
      }

      try {
        const response = await axios.get('/api/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.status === 200) {
          const userData = response.data;
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsAuthorized(false);
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('access_token');
          navigate('/login');
        }
      }
    };

    checkAuthorization();
  }, [navigate]);

  if (isAuthorized === null) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedAdmin;