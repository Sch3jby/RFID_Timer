import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout';
import Home from './components/Home';
import RFIDReader from './components/RFIDReader';
import RegistrationForm from './components/RegistrationForm';
import Calendar from './components/Calendar';
import RaceDetail from './components/RaceDetail';
import RFIDReaderDetail from './components/RFIDReaderDetail';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import ProtectedAdmin from './contexts/ProtectedAdmin';
import ProtectedRegistration from './contexts/ProtectedRegistration';

import './styles/Main.css';

function App() {
  return (
    <LanguageProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route 
              path="/rfid-reader" 
              element={
                <ProtectedAdmin>
                  <RFIDReader />
                </ProtectedAdmin>
              } 
            />
            <Route 
              path="/registration" 
              element={
                <ProtectedRegistration>
                  <RegistrationForm />
                </ProtectedRegistration>
              } 
            />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/race/:id" element={<RaceDetail />} />
            <Route path="/rfid-reader/:raceId" element={<RFIDReaderDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </Layout>
      </Router>
    </LanguageProvider>
  );
}

export default App;