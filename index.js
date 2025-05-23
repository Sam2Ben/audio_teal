import express from 'express';
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';
import FormData from 'form-data';
import fetch from 'node-fetch';

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
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

// Serve static files
app.use(express.static('public'));

// Process audio endpoint for Azure
async function transcribeWithAzureWhisper(audioBuffer, prompt, audioType = 'audio/mpeg') {
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.DEPLOYMENT_NAME;

    const url = `${endpoint}/openai/deployments/${deploymentName}/audio/transcriptions?api-version=${apiVersion}`;

    const formData = new FormData();
    formData.append('file', audioBuffer, {  
        filename: `audio.${audioType.split('/')[1]}`,
        contentType: audioType
    });
    
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    formData.append('prompt', prompt || '');
    const headers = {
        'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
        'Authorization': `Bearer ${apiKey}`
    };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return text;
}   

// Process audio endpoint for Gemini
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

// Process audio endpoint for OpenAI
async function ProcessAudioOpenAI(req, res) {
    try {
        const { audio } = req.body;

        if (!audio) {
            return res.status(400).json({ error: 'No audio data received' });
        }

        // Remove the data:audio/mp3;base64, prefix if present
        const base64Data = audio.replace(/^data:audio\/\w+;base64,/, '');
        const audioBuffer = Buffer.from(base64Data, 'base64');
        // Direct OpenAI Whisper API call using fetch
        const openaiEndpoint = 'https://api.openai.com/v1/audio/transcriptions';
        const formData = new FormData();
        formData.append('file', audioBuffer, {
            filename: 'audio.mp3',
            contentType: 'audio/mpeg'
        });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'text');
        formData.append('prompt', req.body.prompt || ''); // Optional prompt

        const response = await fetch(openaiEndpoint, {
            method: 'POST',
            headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        console.log(text);
        res.json({ transcription: text });

    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}


// Route for Gemini
app.post('/Transcribe/Gemini', ProcessAudioGemini);

// Route for OpenAI Azure

app.post('/Transcribe/Azure', async (req, res) => {
    try {
        const { audio, prompt, mimeType } = req.body;

        if (!audio) {
            return res.status(400).json({ error: 'No audio data received' });
        }

        // Remove the data:audio/mp3;base64, prefix if present
        const base64Data = audio.replace(/^data:audio\/\w+;base64,/, '');
        const audioBuffer = Buffer.from(base64Data, 'base64');

        // Transcribe the audio with the correct MIME type
        const transcription = await transcribeWithAzureWhisper(audioBuffer, prompt, mimeType || 'audio/wav');

        res.json({ transcription });

    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Route for OpenAI
app.post('/Transcribe/OpenAI', ProcessAudioOpenAI);



app.get('/', (_req, res) => {
    res.sendFile(__dirname + '/doc.html');
});

app.get('/azuredemo', (_req, res) => {
    res.sendFile(__dirname + '/public/azuredemo.html');
});

app.get('/geminidemo', (_req, res) => {
    res.sendFile(__dirname + '/public/geminidemo.html');
});

app.get('/openaidemo', (_req, res) => {
    res.sendFile(__dirname + '/public/openaidemo.html');
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
