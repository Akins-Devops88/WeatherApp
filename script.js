/**
 * ================================================================
 * Weather App — script.js
 * ================================================================
 *   • Open-Meteo Geocoding  → converts a city name to coordinates
 *   • Open-Meteo Forecast   → fetches weather for those coordinates
 *   • Nominatim (OSM)       → reverse-geocodes GPS coordinates to a city name
 *
 * Features:
 *   ✅ City search with error handling
 *   ✅ Current weather display (humidity, wind, UV Index)
 *   ✅ 5-day forecast
 *   ✅ CSS-animated hero icon (spinning sun, falling rain, etc.)
 *   ✅ °C / °F unit toggle 
 *   ✅ Last 5 searched cities stored as quick-access chips
 *   ✅ Each chip has a ✕ button to delete it individually
 *   ✅ History is wiped on page refresh (localStorage cleared on init)
 *   ✅ Geolocation auto-detect on page load
 * ================================================================
 */


/* ================================================================
   SECTION 1 — CONSTANTS
   Base URLs for the two external APIs used throughout the app.
   Stored as constants so they are easy to update in one place.
   ================================================================ */

/** Geocoding API: converts a city name into latitude + longitude */
const GEO_URL     = 'https://geocoding-api.open-meteo.com/v1/search';

/** Forecast API: returns current conditions and a 5-day daily forecast */
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';


/* ================================================================
   SECTION 2 — APPLICATION STATE
   Variables that are shared across multiple functions.
   ================================================================ */

/**
 * Holds the most-recently-fetched weather API response object.
 * Stored globally so the unit toggle can re-render without a new fetch.
 * Private city/country names are attached as _cityName and _country.
 * Null when no search has been performed yet.
 * @type {Object|null}
 */
let currentWeatherData = null;

/**
 * The temperature unit currently displayed: 'C' for Celsius, 'F' for Fahrenheit.
 * Defaults to Celsius on page load.
 * @type {'C'|'F'}
 */
let currentUnit = 'C';


/* ================================================================
   SECTION 3 — CSS ICON DEFINITIONS
   Each weather type maps to:
     • iconClass  → CSS class added to .hero-icon (e.g. "icon-clear")
     • html       → inner HTML injected into .hero-icon
   The inner HTML elements are the "shapes" that CSS animations target.
   This approach works because CSS can animate real DOM elements
   (spinning, falling, pulsing), unlike plain emoji which are just
   text characters that cannot have sub-parts animated.
   ================================================================ */

/**
 * HTML strings for each animated CSS icon.
 * Injected into the #heroIcon element by displayCurrentWeather().
 */
const CSS_ICONS = {

  /**
   * CLEAR SKY — spinning sun
   * .sun-rays holds 8 <span> elements rotated evenly around the centre.
   * .sun-body is the circular disc in the middle.
   * The parent .icon-clear rotates the whole group via @keyframes spinSun.
   */
  clear: `
    <div class="sun-rays">
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
    </div>
    <div class="sun-body"></div>`,

  /**
   * PARTLY CLOUDY — floating cloud
   * A single .cloud div styled with border-radius to look like a cloud.
   * CSS ::before and ::after pseudo-elements add the two puff bumps on top.
   * The parent .icon-cloudy bobs up and down via @keyframes floatCloud.
   */
  cloudy: `<div class="cloud"></div>`,

  /**
   * RAIN / DRIZZLE / SHOWERS — falling rain drops
   * Same cloud shape as cloudy, plus a .drops row of four <span> pills
   * that animate sequentially via staggered animation-delay values.
   */
  rain: `
    <div class="cloud"></div>
    <div class="drops">
      <span></span><span></span><span></span><span></span>
    </div>`,

  /**
   * SNOW — drifting snowflakes
   * Cloud with three small circle .flakes that drift downward while
   * rotating, simulating spinning snowflakes falling from a cloud.
   */
  snow: `
    <div class="cloud"></div>
    <div class="flakes">
      <span></span><span></span><span></span>
    </div>`,

  /**
   * THUNDERSTORM — flashing lightning bolt
   * Cloud with a CSS triangle .bolt below it.
   * The bolt pulses between opaque and nearly-invisible via @keyframes boltFlash.
   */
  storm: `
    <div class="cloud"></div>
    <div class="bolt"></div>`,

  /**
   * FOG — drifting horizontal bands
   * Four .fog-line pill shapes of varying widths that drift sideways
   * with offset animation-delay values, giving an organic misty look.
   */
  fog: `
    <div class="fog-line"></div>
    <div class="fog-line"></div>
    <div class="fog-line"></div>
    <div class="fog-line"></div>`,
};


/* ================================================================
   SECTION 4 — WEATHER CODE MAPPING
   The Open-Meteo API uses WMO (World Meteorological Organisation)
   weather interpretation codes. This function converts those numeric
   codes into human-readable text and selects the matching CSS icon.
   ================================================================ */

/**
 * Maps a WMO weather code to a description, CSS icon class, animated
 * hero HTML, and a fallback emoji used in the forecast rows.
 *
 * @param {number} code - WMO weather code from the API response
 * @returns {{
 *   description: string,  - plain English label, e.g. "Partly Cloudy"
 *   iconClass:   string,  - CSS class for .hero-icon, e.g. "icon-rain"
 *   html:        string,  - inner HTML shapes for the animated hero icon
 *   emoji:       string   - emoji used in the small forecast row icons
 * }}
 */
function getWeatherDescription(code) {
  /* WMO code 0 — clear sky */
  if (code === 0)
    return { description: 'Clear Sky',     iconClass: 'icon-clear',  html: CSS_ICONS.clear,  emoji: '☀️'  };

  /* WMO codes 1-3 — mainly clear, partly cloudy, overcast */
  if ([1, 2, 3].includes(code))
    return { description: 'Partly Cloudy', iconClass: 'icon-cloudy', html: CSS_ICONS.cloudy, emoji: '⛅'  };

  /* WMO codes 45, 48 — fog and depositing rime fog */
  if ([45, 48].includes(code))
    return { description: 'Foggy',         iconClass: 'icon-fog',    html: CSS_ICONS.fog,    emoji: '🌫️' };

  /* WMO codes 51-55 — light / moderate / dense drizzle */
  if ([51, 53, 55].includes(code))
    return { description: 'Drizzle',       iconClass: 'icon-rain',   html: CSS_ICONS.rain,   emoji: '🌦️' };

  /* WMO codes 61-65 — slight / moderate / heavy rain */
  if ([61, 63, 65].includes(code))
    return { description: 'Rain',          iconClass: 'icon-rain',   html: CSS_ICONS.rain,   emoji: '🌧️' };

  /* WMO codes 71-75 — slight / moderate / heavy snow fall */
  if ([71, 73, 75].includes(code))
    return { description: 'Snow',          iconClass: 'icon-snow',   html: CSS_ICONS.snow,   emoji: '❄️'  };

  /* WMO codes 80-82 — rain showers (slight / moderate / violent) */
  if ([80, 81, 82].includes(code))
    return { description: 'Rain Showers',  iconClass: 'icon-rain',   html: CSS_ICONS.rain,   emoji: '🌦️' };

  /* WMO code 95 — thunderstorm (slight or moderate) */
  if (code === 95)
    return { description: 'Thunderstorm',  iconClass: 'icon-storm',  html: CSS_ICONS.storm,  emoji: '⛈️' };

  /* WMO codes 96, 99 — thunderstorm with slight / heavy hail */
  if ([96, 99].includes(code))
    return { description: 'Thunderstorm',  iconClass: 'icon-storm',  html: CSS_ICONS.storm,  emoji: '⛈️' };

  /* Fallback for any unrecognised code */
  return { description: 'Unknown',         iconClass: 'icon-cloudy', html: CSS_ICONS.cloudy, emoji: '🌡️' };
}


/* ================================================================
   SECTION 5 — TEMPERATURE UTILITY
   ================================================================ */

/**
 * Converts a Celsius temperature to the currently selected unit and
 * returns a formatted string with the symbol.
 *
 * Uses the currentUnit global so no extra parameter is needed.
 *
 * @param {number} celsius - Temperature value in degrees Celsius
 * @returns {string} e.g. "24°C" or "75°F"
 */
function formatTemp(celsius) {
  if (currentUnit === 'F') {
    /* Standard Celsius → Fahrenheit formula: (°C × 9/5) + 32 */
    const fahrenheit = Math.round((celsius * 9) / 5 + 32);
    return `${fahrenheit}°F`;
  }
  /* Round to nearest whole number; decimals are unnecessary for weather display */
  return `${Math.round(celsius)}°C`;
}


/* ================================================================
   SECTION 6 — API CALLS
   Two async functions that fetch data from external APIs.
   Both throw descriptive Error objects that handleSearch() catches
   and passes to showError() so the user sees a friendly message.
   ================================================================ */

/**
 * GEOCODING — city name → coordinates
 *
 * Calls the Open-Meteo geocoding endpoint with the user's typed city name.
 * Returns the first (best) result's latitude, longitude, name, and country.
 *
 * @param {string} city - Raw city name from the search input
 * @returns {Promise<{ lat: number, lon: number, name: string, country: string }>}
 * @throws {Error} If the network request fails or the city is not found
 */
async function getCoordinates(city) {
  /* encodeURIComponent makes the city name safe to include in a URL
     e.g. "New York" becomes "New%20York" */
  const url = `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

  const response = await fetch(url);

  /* response.ok is true for HTTP 200-299; false for 4xx/5xx errors */
  if (!response.ok) {
    throw new Error('Could not reach the geocoding service. Kindly try again.');
  }

  const data = await response.json();

  /* The API returns an empty results array when the city is not found */
  if (!data.results || data.results.length === 0) {
    throw new Error(`"${city}" The location you entered could not be found. Please review the spelling and try again.`);
  }

  /* Use the first (highest-confidence) result */
  const result = data.results[0];
  return {
    lat:     result.latitude,
    lon:     result.longitude,
    name:    result.name,
    country: result.country,
  };
}


/**
 * WEATHER FETCH — coordinates → weather data
 *
 * Calls the Open-Meteo forecast endpoint requesting:
 *   current  → temperature, humidity, wind speed, weather code, UV index
 *   daily    → max temp, min temp, weather code for each of the next 5 days
 *   timezone → "auto" so Open-Meteo uses the location's local timezone
 *
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Full Open-Meteo API response object
 * @throws {Error} If the network request fails
 */
async function getWeather(lat, lon) {
  /* URLSearchParams serialises the object into a query string automatically */
  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
    current:   'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,uv_index',
    daily:     'temperature_2m_max,temperature_2m_min,weather_code',
    timezone:  'auto',
  });

  const response = await fetch(`${WEATHER_URL}?${params}`);

  if (!response.ok) {
    throw new Error('Could not reach the weather service. Kindly try again.');
  }

  return response.json();
}


/* ================================================================
   SECTION 7 — DOM UPDATE FUNCTIONS
   These functions read from the API response and write values into
   the HTML elements so the user can see the weather data.
   ================================================================ */

/**
 * DISPLAY CURRENT WEATHER
 *
 * Populates the hero card and the three stat cards with current weather.
 * Called after a successful search AND when the user switches °C/°F.
 *
 * @param {Object} weatherData - Full API response (stored in currentWeatherData)
 * @param {string} cityName    - Human-readable city name
 * @param {string} country     - Country name
 */
function displayCurrentWeather(weatherData, cityName, country) {
  const current = weatherData.current;

  /* Look up the CSS icon and description for this weather code */
  const { description, iconClass, html } = getWeatherDescription(current.weather_code);

  /* ── Animated hero icon ────────────────────────────────────────
     1. Set className to "hero-icon icon-clear" (or icon-rain etc.)
        so the correct CSS animation rules apply.
     2. Inject the shape HTML (rays / drops / bolt etc.) so there
        are real DOM elements for those CSS rules to target.
     ──────────────────────────────────────────────────────────── */
  const heroIcon    = document.getElementById('heroIcon');
  heroIcon.className = `hero-icon ${iconClass}`;
  heroIcon.innerHTML = html;

  /* ── Text content ──────────────────────────────────────────── */
  document.getElementById('cityName').textContent    = cityName;
  document.getElementById('countryName').textContent = country;
  document.getElementById('temperature').textContent = formatTemp(current.temperature_2m);
  document.getElementById('weatherDesc').textContent = description;

  /* ── Stat cards ────────────────────────────────────────────── */
  document.getElementById('humidity').textContent  = `${current.relative_humidity_2m}%`;
  document.getElementById('windSpeed').textContent = `${current.wind_speed_10m} km/h`;

  /* UV INDEX — converted from a raw number into a plain-English risk label
     using the standard WHO UV scale:
       0–2  → "Low"      (minimal risk; no protection needed)
       3–5  → "Moderate" (some risk; sunscreen recommended)
       6+   → "High"     (high risk; protection essential)
     Falls back to "–" when the API returns no value (e.g. at night). */
  const uvRaw = current.uv_index;
  let uvLabel = '–';
  if (uvRaw !== undefined && uvRaw !== null) {
    if (uvRaw <= 2)      uvLabel = 'Low';
    else if (uvRaw <= 5) uvLabel = 'Moderate';
    else                 uvLabel = 'High';
  }
  document.getElementById('uvIndex').textContent = uvLabel;
}


/**
 * DISPLAY 5-DAY FORECAST
 *
 * Clears the forecast grid and builds five new forecast rows,
 * one for each of the next 5 days returned by the API.
 * Each row uses an emoji icon (forecast cards are small — CSS icons
 * would be too large; emojis scale well at small sizes here).
 *
 * @param {Object} daily - The `daily` block from the API response containing
 *                         time[], temperature_2m_max[], temperature_2m_min[],
 *                         and weather_code[] arrays.
 */
function displayForecast(daily) {
  const grid = document.getElementById('forecastGrid');

  /* Wipe any previously rendered rows before adding new ones */
  grid.innerHTML = '';

  /* Cap at 5 days even if the API returns more */
  const days = Math.min(daily.time.length, 5);

  for (let i = 0; i < days; i++) {

    /* Adding T12:00:00 avoids DST edge cases where midnight on some dates
       would roll back to the previous day in certain timezones */
    const date    = new Date(daily.time[i] + 'T12:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

    /* Get the emoji for the forecast row (not the full CSS icon) */
    const { emoji } = getWeatherDescription(daily.weather_code[i]);

    /* formatTemp respects the current °C/°F unit selection */
    const high = formatTemp(daily.temperature_2m_max[i]);
    const low  = formatTemp(daily.temperature_2m_min[i]);

    /* Build the card element and inject it into the grid */
    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <div class="forecast-day">${dayName}</div>
      <div class="forecast-icon">${emoji}</div>
      <div class="forecast-temps">
        <span class="temp-high">${high}</span>
        <span class="temp-low">${low}</span>
      </div>
    `;
    grid.appendChild(card);
  }
}


/* ================================================================
   SECTION 8 — UI STATE HELPERS
   Small functions that show/hide elements and manage error display.
   ================================================================ */

/**
 * CLEAR ERROR
 * Removes any previously shown error message.
 * Called at the start of every new search attempt.
 */
function clearError() {
  const el = document.getElementById('errorMsg');
  el.textContent = '';
  el.classList.add('hidden');
}

/**
 * SHOW ERROR
 * Displays a red error card with the given message and hides all
 * weather content so the error is not shown alongside stale data.
 *
 * @param {string} message - The error text to show the user
 */
function showError(message) {
  const el = document.getElementById('errorMsg');
  el.textContent = message;
  el.classList.remove('hidden');

  /* Hide all weather sections so they don't display stale data */
  document.getElementById('heroSection').classList.add('hidden');
  document.getElementById('statsSection').classList.add('hidden');
  document.getElementById('forecastSection').classList.add('hidden');
}

/**
 * SHOW LOADING
 * Displays the "Loading…" spinner and hides weather sections.
 * Called at the start of an API request.
 */
function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('heroSection').classList.add('hidden');
  document.getElementById('statsSection').classList.add('hidden');
  document.getElementById('forecastSection').classList.add('hidden');
  clearError(); /* also clear any previous error */
}

/**
 * HIDE LOADING
 * Hides the spinner and reveals all weather sections.
 * Called when API data has been successfully received and rendered.
 */
function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('heroSection').classList.remove('hidden');
  document.getElementById('statsSection').classList.remove('hidden');
  document.getElementById('forecastSection').classList.remove('hidden');
}


/* ================================================================
   SECTION 9 — SEARCH HISTORY
   Stores up to 5 recently searched cities in localStorage so they
   persist between searches within the same session.
   History is cleared on every page refresh (see init()).
   ================================================================ */

/**
 * GET HISTORY
 * Reads and parses the history array from localStorage.
 * Returns an empty array if nothing is stored or if parsing fails.
 *
 * @returns {string[]} Array of up to 5 city name strings
 */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('weatherHistory')) || [];
  } catch {
    /* If localStorage data is somehow corrupted, return a clean slate */
    return [];
  }
}

/**
 * SAVE TO HISTORY
 * Adds a city to the top of the history array.
 * Removes any existing entry for the same city (case-insensitive)
 * before prepending, so cities never appear twice.
 * Trims the array to a maximum of 5 entries.
 *
 * @param {string} cityName - The resolved city name to save
 */
function saveToHistory(cityName) {
  let history = getHistory();

  /* Remove any existing entry for this city so it moves to the top */
  history = history.filter(c => c.toLowerCase() !== cityName.toLowerCase());

  /* Add the new city at the front of the array */
  history.unshift(cityName);

  /* Keep only the 5 most recent entries */
  if (history.length > 5) history = history.slice(0, 5);

  localStorage.setItem('weatherHistory', JSON.stringify(history));

  /* Re-render the chips immediately so the new city appears */
  renderHistory();
}

/**
 * REMOVE FROM HISTORY
 * Removes a single city from the stored history array and re-renders
 * the chips. Triggered by clicking the ✕ button on a chip.
 *
 * @param {string} cityName - The city name to remove
 */
function removeFromHistory(cityName) {
  const updated = getHistory().filter(
    c => c.toLowerCase() !== cityName.toLowerCase()
  );
  localStorage.setItem('weatherHistory', JSON.stringify(updated));
  renderHistory(); /* update the chips to reflect the deletion */
}

/**
 * RENDER HISTORY
 * Reads the current history array and builds one chip element per city.
 * Each chip has:
 *   • A label <span>  — clicking it re-searches that city
 *   • A delete <button> (✕) — clicking it removes only that city
 *
 * e.stopPropagation() on the delete button prevents the click from
 * bubbling up and accidentally triggering the label's click handler.
 */
function renderHistory() {
  const bar     = document.getElementById('historyBar');
  const history = getHistory();

  /* Clear all existing chips before rebuilding */
  bar.innerHTML = '';

  history.forEach(city => {

    /* Outer chip wrapper */
    const chip = document.createElement('div');
    chip.className = 'history-chip';

    /* City label — click to search */
    const label = document.createElement('span');
    label.className   = 'history-chip-label';
    label.textContent = city;
    label.setAttribute('role', 'button');
    label.setAttribute('aria-label', `Search again: ${city}`);
    label.addEventListener('click', () => {
      document.getElementById('cityInput').value = city;
      handleSearch();
    });

    /* ✕ delete button — click to remove just this city */
    const del = document.createElement('button');
    del.className   = 'history-chip-delete';
    del.textContent = '✕';
    del.setAttribute('aria-label', `Remove ${city} from history`);
    del.addEventListener('click', (e) => {
      e.stopPropagation(); /* prevent the chip label click from also firing */
      removeFromHistory(city);
    });

    chip.appendChild(label);
    chip.appendChild(del);
    bar.appendChild(chip);
  });
}


/* ================================================================
   SECTION 10 — UNIT TOGGLE
   ================================================================ */

/**
 * SET UNIT
 * Switches the temperature display between °C and °F.
 * Does NOT make a new API request — it re-renders using the cached
 * data already stored in currentWeatherData.
 *
 * @param {'C'|'F'} unit - The unit to switch to
 */
function setUnit(unit) {
  /* Do nothing if already on this unit or if no data has loaded yet */
  if (unit === currentUnit || !currentWeatherData) return;

  currentUnit = unit;

  /* Update the visual active state of the two toggle buttons */
  document.getElementById('btnC').classList.toggle('active', unit === 'C');
  document.getElementById('btnF').classList.toggle('active', unit === 'F');

  /* Update aria-pressed so screen readers announce the selection */
  document.getElementById('btnC').setAttribute('aria-pressed', String(unit === 'C'));
  document.getElementById('btnF').setAttribute('aria-pressed', String(unit === 'F'));

  /* Re-render both sections; formatTemp() now uses the new unit */
  displayCurrentWeather(
    currentWeatherData,
    currentWeatherData._cityName,
    currentWeatherData._country
  );
  displayForecast(currentWeatherData.daily);
}


/* ================================================================
   SECTION 11 — GEOLOCATION
   ================================================================ */

/**
 * USE GEOLOCATION
 * Asks the browser for the user's GPS coordinates.
 * If granted, reverse-geocodes them to a city name via Nominatim
 * (OpenStreetMap's free reverse-geocoding service), then fetches
 * and displays the weather for that location.
 *
 * Called automatically on page load (see init()) and also when the
 * user clicks the 📍 button in the bottom-right corner.
 */
function useGeolocation() {
  /* Check browser support before calling the API */
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }

  showLoading();

  navigator.geolocation.getCurrentPosition(

    /* SUCCESS CALLBACK — runs when the browser provides coordinates */
    async (position) => {
      const { latitude: lat, longitude: lon } = position.coords;

      try {
        /* Nominatim converts lat/lon → human-readable place name.
           The User-Agent header is best practice for Nominatim usage. */
        const geoResp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        );
        const geoData = await geoResp.json();

        /* address object contains city / town / village depending on location */
        const addr     = geoData.address || {};
        const cityName = addr.city || addr.town || addr.village || addr.county || 'Your Location';
        const country  = addr.country || '';

        /* Fetch weather using the GPS coordinates (more precise than re-geocoding) */
        const weatherData = await getWeather(lat, lon);

        /* Cache the response and attach the name strings for unit-toggle re-renders */
        currentWeatherData           = weatherData;
        currentWeatherData._cityName = cityName;
        currentWeatherData._country  = country;

        hideLoading();
        displayCurrentWeather(weatherData, cityName, country);
        displayForecast(weatherData.daily);
        saveToHistory(cityName);

      } catch (err) {
        /* Geolocation succeeded but a subsequent API call failed */
        hideLoading();
        showError('Could not retrieve weather information for your location. Please search manually.');
      }
    },

    /* ERROR CALLBACK — runs when the user denies location permission */
    () => {
      hideLoading();
      showError('GeoLocation access was denied. Please search for a city manually.');
    }
  );
}


/* ================================================================
   SECTION 12 — MAIN SEARCH HANDLER
   ================================================================ */

/**
 * HANDLE SEARCH
 * The primary function wired to the Search button (onclick) and
 * the Enter key listener below.
 *
 * Flow:
 *   1. Read and validate the city input
 *   2. Show loading state
 *   3. getCoordinates() — city name → lat/lon
 *   4. getWeather()     — lat/lon → weather data
 *   5. Cache the data
 *   6. displayCurrentWeather() + displayForecast() — update the DOM
 *   7. saveToHistory() — add city to history chips
 *   8. On any error → showError() with a friendly message
 */
async function handleSearch() {
  const input   = document.getElementById('cityInput');
  const cityRaw = input.value.trim(); /* remove leading/trailing whitespace */

  /* Validate: don't send an empty query to the API */
  if (!cityRaw) {
    showError('Please enter a city name to search.');
    return;
  }

  showLoading();

  try {
    /* Step 1 — resolve city name to geographic coordinates */
    const { lat, lon, name, country } = await getCoordinates(cityRaw);

    /* Step 2 — fetch weather for those coordinates */
    const weatherData = await getWeather(lat, lon);

    /* Step 3 — cache the response.
       _cityName and _country are private fields attached to the plain object
       so setUnit() can re-render without needing them as separate variables. */
    currentWeatherData           = weatherData;
    currentWeatherData._cityName = name;
    currentWeatherData._country  = country;

    /* Step 4 — update the DOM */
    hideLoading();
    displayCurrentWeather(weatherData, name, country);
    displayForecast(weatherData.daily);

    /* Step 5 — save to history */
    saveToHistory(name);

  } catch (err) {
    /* Any thrown Error lands here; show its message to the user */
    hideLoading();
    showError(err.message || 'Something went wrong. Kindly try again.');
  }
}


/* ================================================================
   SECTION 13 — KEYBOARD SUPPORT
   ================================================================ */

/**
 * Listen for the Enter key on the search input field.
 * This allows users to press Enter instead of clicking the button,
 * which is standard behaviour users expect from a search field.
 */
document.getElementById('cityInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});


/* ================================================================
   SECTION 14 — INITIALISATION
   Runs immediately when the script loads (IIFE pattern).
   ================================================================ */

/**
 * INIT (Immediately Invoked Function Expression)
 * An IIFE runs its function body once, immediately, without needing
 * to be called. The wrapping () prevents it polluting the global scope.
 *
 * On every page load / refresh:
 *   1. localStorage is cleared so history chips start empty.
 *   2. renderHistory() is called (renders nothing since history is empty).
 *   3. Geolocation is attempted to auto-load the user's local weather.
 */
(function init() {

  /* Clear history on every page load so chips reset on refresh */
  localStorage.removeItem('weatherHistory');

  /* Render the (now-empty) history bar */
  renderHistory();

  /* Auto-detect location if the browser supports geolocation */
  if (navigator.geolocation) {
    useGeolocation();
  }

})();
