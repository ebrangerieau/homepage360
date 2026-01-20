
// Widgets Module (Clock & Weather)

export function initClock() {
    const timeEl = document.getElementById('current-time');
    const dateEl = document.getElementById('current-date');

    const update = () => {
        const now = new Date();

        // Time format: HH:MM:SS
        timeEl.textContent = now.toLocaleTimeString('fr-FR', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Tech date format: MAY 24, 2025
        const options = { month: 'short', day: '2-digit', year: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('en-US', options).toUpperCase();
    };

    update();
    setInterval(update, 1000);
}

export function initWeather() {
    const iconEl = document.querySelector('.weather-icon');
    const tempEl = document.querySelector('.weather-temp');
    const widgetEl = document.querySelector('#weather-widget');

    // Modal Elements
    const modal = document.getElementById('weather-modal');
    const form = document.getElementById('weather-form');
    const cancelBtn = document.getElementById('cancel-weather-btn');
    const gpsBtn = document.getElementById('use-gps-btn');

    const weatherIcons = {
        0: '☀️', // Clear sky
        1: '🌤️', 2: '⛅', 3: '☁️', // Partly cloudy
        45: '🌫️', 48: '🌫️', // Fog
        51: '🌦️', 53: '🌦️', 55: '🌦️', // Drizzle
        61: '🌧️', 63: '🌧️', 65: '🌧️', // Rain
        71: '❄️', 73: '❄️', 75: '❄️', // Snow
        80: '🌦️', 81: '🌦️', 82: '🌦️', // Showers
        86: '❄️', 95: '⛈️',
        96: '⛈️', 99: '⛈️'
    };

    const updateUI = (data) => {
        const current = data.current_weather;
        if (current) {
            tempEl.textContent = `${Math.round(current.temperature)}°C`;
            iconEl.textContent = weatherIcons[current.weathercode] || '☀️';
            iconEl.title = `Code: ${current.weathercode}`;
        }
    };

    const fetchWeather = async (lat, lon) => {
        try {
            const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const data = await resp.json();
            updateUI(data);
        } catch (err) {
            console.error('Weather error:', err);
            iconEl.textContent = '❌';
            tempEl.textContent = '--';
        }
    };

    const loadWeather = () => {
        // Dynamic import to get current config
        import('./store.js').then(({ getConfig }) => {
            const config = getConfig();
            if (config.weather && config.weather.lat && config.weather.lon) {
                fetchWeather(config.weather.lat, config.weather.lon);
                widgetEl.title = `Météo pour ${config.weather.name}`;
            } else {
                // Fallback to GPS or Paris
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
                        () => fetchWeather(48.8566, 2.3522)
                    );
                } else {
                    fetchWeather(48.8566, 2.3522);
                }
            }
        });
    };

    // UI Handlers
    widgetEl.style.cursor = 'pointer';
    widgetEl.addEventListener('click', () => {
        modal.classList.remove('hidden');
        import('./store.js').then(({ getConfig }) => {
            const config = getConfig();
            if (config.weather && config.weather.name) {
                form.elements['city'].value = config.weather.name;
            }
        });
    });

    const close = () => modal.classList.add('hidden');
    cancelBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const city = new FormData(form).get('city');
        try {
            // Geocoding
            const geoResp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`);
            const geoData = await geoResp.json();

            if (geoData.results && geoData.results.length > 0) {
                const result = geoData.results[0];
                const weatherData = {
                    lat: result.latitude,
                    lon: result.longitude,
                    name: result.name,
                    country: result.country
                };

                // Save
                import('./store.js').then(({ getConfig, persistState }) => {
                    const config = getConfig();
                    config.weather = weatherData;
                    persistState();
                    loadWeather();
                    close();
                    // Optional: Toast
                    import('./ui.js').then(({ showToast }) => showToast(`Météo mise à jour : ${result.name}`, 'success'));
                });
            } else {
                import('./ui.js').then(({ showToast }) => showToast('Ville introuvable', 'error'));
            }
        } catch (err) {
            console.error(err);
        }
    });

    gpsBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                import('./store.js').then(({ getConfig, persistState, showToast }) => {
                    const config = getConfig();
                    // Check if we want to save GPS as a "fixed" location or just clear the manual override?
                    // Let's clear manual override to revert to auto-GPS
                    delete config.weather;
                    persistState();
                    loadWeather();
                    close();
                    import('./ui.js').then(({ showToast }) => showToast('Position GPS utilisée', 'success'));
                });
            });
        }
    });

    // Initial Load
    loadWeather();

    // Refresh loop
    setInterval(loadWeather, 30 * 60 * 1000);
}
