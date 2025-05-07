import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Load environment variables
dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;


const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });



// CORS middleware
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Serve static files
app.use(express.static('public'));

// Process audio endpoint
async function ProcessAudioGemini(req, res) {
    try {

        // audio
        const { audio } = req.body;

        // prompt
        const { prompt } = req.body;


        if (!audio) {
            return res.status(400).json({ error: 'No audio data received' });
        }

        const contents = [
            { text: prompt },
            {
                inlineData: {
                    mimeType: "audio/mp3",
                    data: audio
                }
            }
        ];
        

        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: contents,
          });

        const text = result.candidates[0].content;
        console.log(result.candidates[0].content);
        res.json({ summary: text });

    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}

// Routes
app.post('/Transcribe/Gemini', ProcessAudioGemini);



app.get('/', (_req, res) => {
    res.sendFile(__dirname + '/doc.html');
});

app.get('/demo', (_req, res) => {
    res.sendFile(__dirname + '/demo.html');
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
