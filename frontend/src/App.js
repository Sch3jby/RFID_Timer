import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

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
import ProfilePage from './components/ProfilePage';
import AboutUs from "./components/AboutUs";

import { LanguageProvider } from './contexts/LanguageContext';
import ProtectedAdmin from './contexts/ProtectedAdmin';
import ProtectedRegistration from './contexts/ProtectedRegistration';

import './styles/Main.css';

/**
 * Main application component that sets up routing and language context.
 * Defines the application routes and protects admin and registration routes.
 * @returns Application with routing setup
 */

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
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/aboutus" element={<AboutUs />} />
          </Routes>
        </Layout>
      </Router>
    </LanguageProvider>
  );
}

export default App;