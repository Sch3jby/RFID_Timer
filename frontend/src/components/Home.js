// components/Home.js
import React from "react";
import { useTranslation } from '../contexts/LanguageContext';
import video from '../styles/other/video2.mp4'

/**
 * Home page component.
 * Displays a video background landing page.
 * @returns Rendered home page
 */

function Home() {
  const { t } = useTranslation();
  return (
    <div className="home-container">
      <div className="video-background">
        <video src={video} autoPlay muted loop id="background-video"/>
      </div>
      
      <div className="content">
        {/* <h1>{t('home.welcome')}</h1> */}
        {/* <p>{t('home.selectOption')}</p> */}
      </div>
    </div>
  );
}

export default Home;