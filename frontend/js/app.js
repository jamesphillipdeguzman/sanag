const API_BASE_URL = 'http://localhost:8000';

async function fetchEvents() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/events`);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        console.log("SANAG API Connected:", data);
        // TODO: Pass this data to map.js and charts.js

    } catch (error) {
        console.error("Failed to fetch from API. Is Docker running?", error);
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    fetchEvents();
});