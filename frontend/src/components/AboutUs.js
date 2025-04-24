// components/AboutUs.js
import React from 'react';
import profilepicture from '../styles/other/profilepicture.png';
import { useTranslation } from "../contexts/LanguageContext";

/**
 * About Us page component displaying information about the developer.
 * Includes profile picture, quote, contact information, bio and location map.
 * @returns Rendered About Us page
 */

const AboutUs = () => {
  const { t } = useTranslation();
  
  return (
    <div className="about-us-container">
      <div className="top-section">
        <div className="profile-image-container">
          <img 
            src={profilepicture} 
            alt={t('about.profileImageAlt')} 
            className="profile-image"
          />
        </div>

        <div className="quote-container">
          <div className="quote">
            "{t('about.quote')}"
          </div>
        </div>
      </div>

      <div className="info-section">
        <div className="personal-info">
          <h1 className="name">{t('about.name')}</h1>
          <div className="contact-info">
            <p className="contact-item">
              <span className="contact-label">{t('about.email')}:</span> jan.schejbal@tul.cz
            </p>
            <p className="contact-item">
              <span className="contact-label">{t('about.phone')}:</span> +420 123 456 789
            </p>
          </div>
          
          <p className="bio">
            {t('about.bio')}
          </p>
        </div>
        
        <div className="location-section">
          <h2 className="location-title">{t('about.location')}</h2>
          <div className="map-container">
            <iframe
              title="Liberec Map"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d81287.84130984937!2d15.0845041!3d50.7692675!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x470936999212df43%3A0x400af0f66155990!2sLiberec%2C%20Czechia!5e0!3m2!1sen!2s!4v1709623291453!5m2!1sen!2s"
              width="100%" 
              height="300" 
              style={{ border: 0 }} 
              allowFullScreen="" 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;