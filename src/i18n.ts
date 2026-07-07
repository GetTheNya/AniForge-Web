import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      nav: {
        catalog: "Catalog",
        library: "Library",
        settings: "Settings"
      },
      status: {
        watching: "Watching",
        completed: "Completed",
        planning: "Planning",
        onHold: "On Hold",
        dropped: "Dropped",
        CURRENT: "Watching",
        COMPLETED: "Completed",
        PLANNING: "Planning",
        PAUSED: "On Hold",
        DROPPED: "Dropped"
      },
      dbStatus: {
        idle: "Idle",
        loading: "Loading...",
        ready: "Ready",
        checking: "Checking...",
        downloading: "Downloading...",
        processing: "Processing...",
        error: "Error"
      },
      settings: {
        title: "Settings",
        language: "Language",
        preferUk: "Prefer Ukrainian Titles",
        preferUkSubtext: "Prioritizes localized Ukrainian title indexing from the database catalog if available.",
        english: "English",
        ukrainian: "Ukrainian"
      },
      catalog: {
        searchPlaceholder: "Search anime...",
        startSearching: "Start searching to explore the catalog",
        noResults: "No anime found matching your search",
        connectionError: "Connection Error",
        retry: "Retry",
        initializing: "Initializing AniForge",
        downloadingCatalog: "Downloading Anime Catalog"
      },
      detail: {
        info: "Info",
        timeline: "Timeline",
        synopsis: "Synopsis",
        noDescription: "No description available in catalog.",
        watchTrailer: "Watch Trailer",
        noMedia: "No media items available for this anime.",
        relations: "Relations",
        noRelations: "No relation cross-references found in catalog.",
        staff: "Staff",
        noStaff: "No staff database records registered.",
        franchise: "Franchise",
        noFranchise: "This anime is not registered as part of any media franchise.",
        franchiseTimelineInfo: "Part of a franchise timeline containing {{count}} entries.",
        recommended: "Recommended For You",
        myTracking: "My Tracking",
        watchStatus: "Watch Status",
        episodeProgress: "Episode Progress",
        myScore: "My Score",
        privateNotes: "Private Notes",
        notesPlaceholder: "Write a private comment, review or watch history diary...",
        animeDetails: "Anime Details",
        studios: "Studios",
        totalEpisodes: "Total Episodes",
        duration: "Duration",
        minutesPerEp: "minutes per episode",
        originalSource: "Original Source",
        airingStatus: "Airing Status",
        genres: "Genres",
        tags: "Tags",
        backToCatalog: "Back to Catalog",
        detailsUnavailable: "Details Unavailable",
        loadingDetails: "Loading anime details...",
        addToCollection: "Add to Collection",
        createCollection: "Create New Collection",
        name: "Name",
        descriptionOpt: "Description (Optional)",
        descPlaceholder: "Short description of this collection...",
        createAndAdd: "Create & Add",
        creating: "Creating...",
        noCollections: "You haven't created any collections yet.",
        close: "Close",
        cancel: "Cancel",
        unrated: "Unrated",
        more: "more",
        viewPoster: "View Poster",
        signInDetails: "Sign in with Google to synchronize your watchlists, track episode progress, rate titles, and write personal diaries."
      },
      library: {
        title: "My Library",
        subtext: "Manage your anime lists and custom offline-first compilations.",
        myLists: "My Lists",
        customCollections: "Custom Collections",
        syncTitle: "Sync & Personalize Your Library",
        syncSubtext: "Sign in with Google to create custom anime collections, track your watching progress, and sync everything offline."
      },
      common: {
        signOut: "Sign Out",
        signInGoogle: "Sign in with Google",
        poweredBy: "Powered by SQLite WASM + Supabase"
      }
    }
  },
  uk: {
    translation: {
      nav: {
        catalog: "Каталог",
        library: "Бібліотека",
        settings: "Налаштування"
      },
      status: {
        watching: "Дивлюсь",
        completed: "Завершено",
        planning: "У планах",
        onHold: "Призупинено",
        dropped: "Покинуто",
        CURRENT: "Дивлюсь",
        COMPLETED: "Завершено",
        PLANNING: "У планах",
        PAUSED: "Призупинено",
        DROPPED: "Покинуто"
      },
      dbStatus: {
        idle: "В очікуванні",
        loading: "Завантаження...",
        ready: "Готово",
        checking: "Перевірка...",
        downloading: "Завантаження...",
        processing: "Обробка...",
        error: "Помилка"
      },
      settings: {
        title: "Налаштування",
        language: "Мова",
        preferUk: "Пріоритет українських назв",
        preferUkSubtext: "Надавати перевагу україномовним назвам аніме, якщо вони є в базі даних.",
        english: "Англійська",
        ukrainian: "Українська"
      },
      catalog: {
        searchPlaceholder: "Пошук аніме...",
        startSearching: "Почніть пошук, щоб дослідити каталог",
        noResults: "Не знайдено аніме за вашим запитом",
        connectionError: "Помилка з'єднання",
        retry: "Повторити",
        initializing: "Ініціалізація AniForge",
        downloadingCatalog: "Завантаження каталогу аніме"
      },
      detail: {
        info: "Інфо",
        timeline: "Хронологія",
        synopsis: "Синопсис",
        noDescription: "Опис відсутній у каталозі.",
        watchTrailer: "Дивитися трейлер",
        noMedia: "Для цього аніме немає медіаматеріалів.",
        relations: "Зв'язки",
        noRelations: "У каталозі не знайдено пов'язаних проектів.",
        staff: "Персонал",
        noStaff: "У базі даних не зареєстровано авторів чи акторів.",
        franchise: "Франшиза",
        noFranchise: "Це аніме не зареєстроване як частина будь-якої медіа-франшизи.",
        franchiseTimelineInfo: "Частина хронології франшизи, що містить {{count}} записів.",
        recommended: "Рекомендовано для вас",
        myTracking: "Мій прогрес",
        watchStatus: "Статус перегляду",
        episodeProgress: "Прогрес серій",
        myScore: "Моя оцінка",
        privateNotes: "Особисті нотатки",
        notesPlaceholder: "Напишіть особистий коментар, відгук або щоденник перегляду...",
        animeDetails: "Деталі аніме",
        studios: "Студії",
        totalEpisodes: "Всього серій",
        duration: "Тривалість",
        minutesPerEp: "хвилин на серію",
        originalSource: "Оригінальне джерело",
        airingStatus: "Статус трансляції",
        genres: "Жанри",
        tags: "Теги",
        backToCatalog: "Назад до каталогу",
        detailsUnavailable: "Деталі недоступні",
        loadingDetails: "Завантаження деталей аніме...",
        addToCollection: "Додати до колекції",
        createCollection: "Створити нову колекцію",
        name: "Назва",
        descriptionOpt: "Опис (необов'язково)",
        descPlaceholder: "Короткий опис цієї колекції...",
        createAndAdd: "Створити та додати",
        creating: "Створення...",
        noCollections: "Ви ще не створили жодної колекції.",
        close: "Закрити",
        cancel: "Скасувати",
        unrated: "Без оцінки",
        more: "більше",
        viewPoster: "Дивитися постер",
        signInDetails: "Увійдіть за допомогою Google, щоб синхронізувати свої списки, відстежувати прогрес епізодів, оцінювати та вести особистий щоденник."
      },
      library: {
        title: "Моя бібліотека",
        subtext: "Керуйте своїми списками аніме та власними офлайн-колекціями.",
        myLists: "Мої списки",
        customCollections: "Власні колекції",
        syncTitle: "Синхронізуйте та персоналізуйте свою бібліотеку",
        syncSubtext: "Увійдіть за допомогою Google, щоб створювати власні колекції аніме, відстежувати свій прогрес перегляду та синхронізувати все в офлайні."
      },
      common: {
        signOut: "Вийти",
        signInGoogle: "Увійти через Google",
        poweredBy: "Працює на SQLite WASM + Supabase"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'aniforge_lang',
      caches: ['localStorage']
    }
  });

export default i18n;
