// Vercel Serverless Function (Node.js 18+)
// Proxies requests to Google Gemini API to hide the API Key

module.exports = async (req, res) => {
    // 1. Method check
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Environment Variable check
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        console.error('Missing GEMINI_API_KEY environment variable');
        return res.status(500).json({ error: 'Server configuration error: API Key missing' });
    }

    try {
        // 3. Forward request to Google Gemini API
        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        const targetUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;

        // Note: In Node 18+, fetch is native. If older, might need polyfill.
        // Vercel usually defaults to recent Node.
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        // Check if response is okay
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('Gemini API Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
