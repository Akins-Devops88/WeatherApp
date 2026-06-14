# WeatherApp
Weather App that fetches and displays real live weather data from Open-Meteo Weather Forecast API
# Student Information
**Name:** Ayorinde  Akinyele
**Student ID:** ALT/SOE/BAR/026/0303
## Project Description
# Technologies Used
	•	HTML5
	•	CSS3
	•	JavaScript (ES6)
	•	Fetch API
	•	Open-Meteo Geocoding API
	•	Open-Meteo Weather Forecast API
# Features
	•	Search weather by city name
	•	Current weather display
	•	5-day weather forecast
	•	Geolocation 
	•	Search history with localStorage
	•	°C / °F temperature toggle
	•	Animated weather icons
	•	Responsive design
	•	Error handling and loading states
I built this weather app using plain HTML, CSS, and JavaScript — no frameworks or libraries. The HTML provides the page structure, including a sticky header, a search section, a hero weather card, a stats row, and a 5-day forecast section, all wrapped in a centred container that works on both desktop and mobile screens. For styling, I used CSS custom properties (variables) to manage the colour palette consistently across the app, CSS Grid and Flexbox for layout, and custom `@keyframes` animations to create CSS-drawn animated weather icons (a spinning sun, falling rain drops, drifting snowflakes, a flashing lightning bolt, and drifting fog bands) in place of plain emoji. The JavaScript fetches live weather data from two free APIs — Open-Meteo for geocoding and forecasts, and Nominatim for reverse geocoding GPS coordinates — using the `async/await` pattern for clean, readable asynchronous code. Additional features include a °C/°F unit toggle that converts temperatures without re-fetching, a geolocation button that auto-detects the user's location on page load, and a search history bar that stores the last five searched cities as quick-access chips (with individual delete buttons) using `localStorage`, which is cleared on every page refresh.
