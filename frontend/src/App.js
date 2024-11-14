import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout';
import Home from './components/Home';
import RFIDReader from './components/RFIDReader';
import RegistrationForm from './components/RegistrationForm';
import StartList from './components/StartList';
import Calendar from './components/Calendar';
import RaceDetail from './components/RaceDetail';

import './styles/Main.css';

function App() {
  return (
    <LanguageProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/timer" element={<RFIDReader />} />
            <Route path="/registration" element={<RegistrationForm />} />
            <Route path="/startlist" element={<StartList />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/race/:id" element={<RaceDetail />} />
          </Routes>
        </Layout>
      </Router>
    </LanguageProvider>
  );
}

export default App;