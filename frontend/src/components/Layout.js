// components/Layout.js
import React from "react";
import Navigation from './Navigation';

/**
 * Main layout component for the application.
 * Wraps page content with navigation and main container.
 * 
 * @param {React.ReactNode} children - Child components to render within the layout
 * @returns Rendered layout with navigation and main content
 */

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