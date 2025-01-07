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
      common: {
        loading: "Načítání"
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
        raceSelection: "Volba závodu",
        date: "Datum",
        description: "Popis",
        selectRace: "Zvolit závod",
        startType: "Typ startu",
        confirm: "Potvrdit startovku",
        confirmed: "Startovka potvrzena",
        back: "Zpět",
        curTags: "Viditelné Tagy",
        noTags: "Nebyly načtené žádné Tagy",
        manual: "Manuální vložení",
        number: "Číslo závodníka",
        enterNumber: "Vložte číslo",
        time: "Čas",
        insert: "Vložit záznam",
        stored: "Uložené Tagy",
        noStored: "Žádné uložené Tagy",
        categories: "Kategorie",
        age: "Věk",
        noCat: "Nebyly nalezeny žádné kategorie"
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
        startList: "Startovní listina",
        resultList: "Výsledková listina",
        date: "Datum",
        loading: "Načítání...",
        error: "Chyba při načítání závodů",
        search: "Hledat",
        startType: "Typ startu",
        participants: "Seznam přihlášených",
        description: "Popis",
        register: "Přihlásit se",
        noParticipants: "Nebyli nalezeni žádní uživatelé",
        results: "Výsledková listina",
        groupByTrack: "Celkové",
        groupByCategory: "Kategorie",
        columns: {
          name: "Jméno",
          club: "Klub/Město",
          category: "Kategorie",
          track: "Trať",
          startTime: "Čas startu",
          number: "Číslo",
          position: "Pořadí",
          totalTime: "Čas v cíli",
          behindTime: "Ztráta"
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
      common: {
        loading: "Loading"
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
        raceSelection: "Select race",
        date: "Date",
        description: "Description",
        selectRace: "Select race",
        startType: "Start type",
        confirm: "Confirm startlist",
        confirmed: "Startlist confirmed",
        back: "Back",
        curTags: "Visible Tags",
        noTags: "No Tags visible",
        manual: "Manual entry",
        number: "Competitor number",
        enterNumber: "Enter number",
        time: "Time",
        insert: "Insert record",
        stored: "Stored Tags",
        noStored: "No stored Tags",
        categories: "Categories",
        age: "Age",
        noCat: "No categories found"
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
        startList: "Start list",
        resultList: "Result list",
        date: "Date",
        loading: "Loading...",
        error: "Error loading races",
        search: "Search",
        startType: "Start type",
        participants: "Registered users",
        description: "Description",
        register: "Register",
        noParticipants: "No users found",
        results: "Result list",
        groupByTrack: "Overall",
        groupByCategory: "Categories",
        columns: {
          name: "Name",
          club: "Club/City",
          category: "Category",
          track: "Track",
          startTime: "Start time",
          number: "Number",
          position: "Position",
          totalTime: "Finish time",
          behindTime: "Loss"
        }
      }
    }

  };