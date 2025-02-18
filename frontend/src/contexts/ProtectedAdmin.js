import React, { useState, useEffect } from 'react';
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
        const response = await fetch('http://localhost:5001/api/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setIsAuthorized(userData.role === 1);
        } else {
          setIsAuthorized(false);
          if (response.status === 401) {
            localStorage.removeItem('access_token');
            navigate('/login');
          }
        }
      } catch (error) {
        console.error('Error checking authorization:', error);
        setIsAuthorized(false);
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