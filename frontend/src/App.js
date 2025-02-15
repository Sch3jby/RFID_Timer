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
import ProtectedRoute from './contexts/ProtectedRoutes';

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
                <ProtectedRoute>
                  <RFIDReader />
                </ProtectedRoute>
              } 
            />
            <Route path="/registration" element={<RegistrationForm />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/race/:id" element={<RaceDetail />} />
            <Route path="/rfid-reader/:raceId" element={<RFIDReaderDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </Layout>
      </Router>
    </LanguageProvider>
  );
}

export default App;