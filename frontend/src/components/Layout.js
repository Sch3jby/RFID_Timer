import React from "react";
import Navigation from './Navigation';

function Layout({ children }) {
  return (
    <div className="app-container">
      <Navigation />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;