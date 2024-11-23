import Calendar from "../components/Calendar";
import RaceDetail from "../components/RaceDetail";

export const translations = {
    cs: {
      nav: {
        home: "Domů",
        organizer: "Organizátor",
        competitor: "Registrace",
        startList: "Startovní listina",
        calendar: "Kalendář"
      },
      home: {
        welcome: "Vítejte v systému pro závody",
        selectOption: "Vítejte na úvodní stránce."
      },
      registration: {
        title: "Registrace",
        firstName: "Jméno",
        lastName: "Příjmení",
        birthYear: "Rok narození",
        club: "Klub / Město",
        email: "Email",
        gender: "Pohlaví",
        select: "Vyberte...",
        male: "Muž",
        female: "Žena",
        register: "Registrovat",
        success: "Uživatel byl úspěšně zaregistrován",
        error: "Chyba při registraci",
        race: "Závod",
        track: "Trať"
      },
      rfidReader: {
        title: "RFID Reader",
        connect: "Připojit",
        disconnect: "Odpojit",
        connecting: "Připojování...",
        connected: "Připojeno k RFID čtečce.",
        disconnected: "Odpojeno od RFID čtečky.",
        error: "Chyba: ",
        start: "Start",
        stop: "Stop",
        race: "Závod",
        select: "Vyberte...",
      },
      calendar: {
        title: "Kalendář",
        loading: "Načítání...",
        error: "Chyba při načítání závodů",
        search: "Hledat",
        columns: {
          name: "Závod",
          date: "Datum"
        }
      },
      raceDetail: {
        date: "Datum",
        loading: "Načítání...",
        error: "Chyba při načítání závodů",
        search: "Hledat",
        startType: "Typ startu",
        participants: "Seznam přihlášených",
        description: "Popis",
        register: "Přihlásit se",
        noParticipants: "Nebyli nalezeni žádní uživatelé",
        columns: {
          name: "Jméno",
          club: "Klub/Město",
          category: "Kategorie",
          track: "Trať",
          startTime: "Čas startu"
        }
      }
    },
    en: {
      nav: {
        home: "Home",
        organizer: "Organizer",
        competitor: "Registration",
        startList: "Start List",
        calendar: "Calendar"
      },
      home: {
        welcome: "Welcome to the Race System",
        selectOption: "Welcome on the homepage"
      },
      registration: {
        title: "Registration",
        firstName: "First Name",
        lastName: "Last Name",
        birthYear: "Birth Year",
        club: "Club / City",
        email: "Email",
        gender: "Gender",
        select: "Select...",
        male: "Male",
        female: "Female",
        register: "Register",
        success: "User has been successfully registered",
        error: "Registration error",
        race: "Race",
        track: "Track"
      },
      rfidReader: {
        title: "RFID Reader",
        connect: "Connect",
        disconnect: "Disconnect",
        connecting: "Connecting...",
        connected: "Connected to RFID reader.",
        disconnected: "Disconnected from RFID reader.",
        error: "Error: ",
        start: "Start",
        stop: "Stop",
        race: "Race",
        select: "Select...",
      },
      calendar: {
        title: "Calendar",
        loading: "Loading...",
        error: "Error loading races",
        search: "Search",
        columns: {
          name: "Race",
          date: "Date"
        }
      },
      raceDetail: {
        date: "Date",
        loading: "Loading...",
        error: "Error loading races",
        search: "Search",
        startType: "Start type",
        participants: "List of registered users",
        description: "Description",
        register: "Register",
        noParticipants: "No users found",
        columns: {
          name: "Name",
          club: "Club/City",
          category: "Category",
          track: "Track",
          startTime: "Start time"
        }
      }
    }

  };