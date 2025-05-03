# CheckPoint - RFID Sports Timing System

![CheckPoint Logo](docs/logo.png)

## About the Project

CheckPoint is a comprehensive web-based RFID timing system designed for sporting events. The application provides a full-featured race management platform for organizers and participants alike. Created as part of a bachelor's thesis at the Technical University of Liberec by Jan Schejbal, the system aims to offer a reliable and affordable solution for timing sports events.

## Key Features

- **Race Management**: Create, edit, and manage races with customizable tracks and categories
- **RFID Integration**: Connect with RFID readers to automatically track participant times
- **User Registration**: Allow participants to register for events through the platform
- **Real-time Results**: View race results in real-time with automatic timing calculations
- **Multilingual Support**: Full support for Czech and English languages
- **Responsive Design**: Works on desktop and mobile devices

## System Architecture

The project is built with a modern tech stack:

- **Frontend**: React.js with responsive CSS styling
- **Backend**: Python Flask with RESTful API
- **Database**: PostgreSQL
- **Deployment**: Docker containers with Nginx

## Installation

### Prerequisites

- Docker and Docker Compose
- Git

### Setup Instructions

1. Clone the repository
   ```
   git clone https://github.com/yourusername/checkpoint.git
   cd checkpoint
   ```

2. Development environment setup
   ```
   docker-compose up -d
   ```

3. Production environment setup
   ```
   docker-compose -f docker-compose.prod.yml up -d
   ```

The application will be accessible at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001
- Database Admin: http://localhost:8080

## Testing

The project includes comprehensive test coverage for both frontend and backend components.

### Backend Tests

![Backend Test Results](docs/backendtests.png)

Run backend tests with:
```
cd backend
pytest
```

### Frontend Tests

![Frontend Test Results](docs/frontendtests.png)

Run frontend tests with:
```
cd frontend
npm test
```

## Project Structure

### Backend

The backend is organized into several key components:

- **app.py**: Main application entry point
- **blueprints/**: API endpoints organized by feature
  - **auth.py**: Authentication endpoints
  - **registration.py**: Race registration
  - **race_management.py**: Race administration
  - **results.py**: Race results processing
  - **rfid.py**: RFID reader integration
  - **startlist.py**: Start list management
- **database/**: Data models and database operations
- **extensions.py**: Flask extensions configuration

### Frontend

The frontend follows a component-based architecture:

- **components/**: UI components
  - **RFIDReader.js**: RFID reader management interface
  - **RaceDetail.js**: Race information display
  - **ResultList.js**: Results visualization
  - **StartList.js**: Start list management
  - **Editor.js**: Results and start list editor
- **contexts/**: React context providers
  - **LanguageContext.js**: Multilingual support
  - **ProtectedAdmin.js**: Admin route protection
- **styles/**: CSS styling

## API Documentation

The API provides endpoints for all race management features:

- **Authentication**
  - POST `/api/login`: User login
  - POST `/api/register`: User registration
  - GET `/api/me`: Current user information
  
- **Race Management**
  - GET `/api/races`: List all races
  - POST `/api/race/add`: Create new race
  - PUT `/api/race/{id}/update`: Update race
  - GET `/api/race/{id}`: Get race details
  
- **RFID Integration**
  - POST `/api/connect`: Connect to RFID reader
  - GET `/api/fetch_taglist`: Fetch tag readings
  - POST `/api/store_results`: Store RFID results

For detailed API documentation, refer to the [technical documentation](docs/technicka_dokumentace.pdf).

## User Roles

The system supports two primary user roles:

1. **Organizers**: Can create and manage races, access RFID reader functionality, and edit results
2. **Participants**: Can register for races and view results

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Technical University of Liberec
- Thesis supervisor: [Supervisor Name]
- All beta testers and contributors

## Contact

Jan Schejbal - jan.schejbal@tul.cz

Project Repository: [https://github.com/yourusername/checkpoint](https://github.com/yourusername/checkpoint)
