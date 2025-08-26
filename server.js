// -----------------------------------------------------------------------------
// Requisitos e Configuração Inicial
// -----------------------------------------------------------------------------
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const port = process.env.PORT || 3000;

// Configurações do Express
app.set('view engine', 'ejs');
app.use(express.static('public'));

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// -----------------------------------------------------------------------------
// Credenciais da API e Variáveis Globais
// -----------------------------------------------------------------------------
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${port}/callback`;

let userTokens = {};

// -----------------------------------------------------------------------------
// Internacionalização (i18n)
// -----------------------------------------------------------------------------
const locales = {
    en: JSON.parse(fs.readFileSync(path.join(__dirname, 'locales/en.json'), 'utf8')),
    pt: JSON.parse(fs.readFileSync(path.join(__dirname, 'locales/pt.json'), 'utf8')),
    es: JSON.parse(fs.readFileSync(path.join(__dirname, 'locales/es.json'), 'utf8')),
};

const languageMiddleware = (req, res, next) => {
    let lang = req.query.lang || (req.headers['accept-language'] || 'en').split(',')[0].split('-')[0];
    lang = locales[lang] ? lang : 'en';
    req.language = lang;
    req.t = locales[lang];
    next();
};

app.use(languageMiddleware);

// -----------------------------------------------------------------------------
// Funções Auxiliares
// -----------------------------------------------------------------------------
const reFetchActivityData = async (activityId) => {
    const keys = 'latlng,time,distance';
    const [activityDetailsRes, streamsRes] = await Promise.all([
        axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, { headers: { 'Authorization': `Bearer ${userTokens.access_token}` } }),
        axios.get(`https://www.strava.com/api/v3/activities/${activityId}/streams`, { headers: { 'Authorization': `Bearer ${userTokens.access_token}` }, params: { keys, key_by_type: true } })
    ]);

    const activity = activityDetailsRes.data;
    const streams = streamsRes.data;
    
    const trackpoints = (streams.time?.data || []).map((time, i) => ({
        latlng: streams.latlng?.data[i] || null,
        time: new Date(new Date(activity.start_date).getTime() + time * 1000),
    }));

    return { activity, trackpoints };
};


// -----------------------------------------------------------------------------
// Rotas da Aplicação
// -----------------------------------------------------------------------------
app.get('/', (req, res) => res.render('index', { t: req.t, lang: req.language }));

app.get('/authorize', (req, res) => {
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=read,activity:read_all`;
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    try {
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
            code: req.query.code, grant_type: 'authorization_code',
        });
        userTokens = response.data;
        res.redirect('/activities');
    } catch (error) {
        console.error('Erro ao obter token:', error.response?.data || error.message);
        res.status(500).send('Falha na autenticação com o Strava.');
    }
});

app.get('/activities', async (req, res) => {
    if (!userTokens.access_token) return res.redirect('/');
    
    if (userTokens.expires_at < Date.now() / 1000) {
        try {
            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
                grant_type: 'refresh_token', refresh_token: userTokens.refresh_token,
            });
            userTokens = response.data;
        } catch (error) { return res.redirect('/'); }
    }

    try {
        const response = await axios.get(`https://www.strava.com/api/v3/athlete/activities`, {
            headers: { 'Authorization': `Bearer ${userTokens.access_token}` },
            params: { per_page: 30 }
        });
        
        const currentFilter = req.query.filter || 'gps';
        let activities = response.data;

        if (currentFilter === 'gps') {
            activities = activities.filter(activity => activity.map && activity.map.summary_polyline);
        }

        const translatedActivities = activities.map(activity => ({
            ...activity,
            translated_type: req.t[activity.type] || activity.type
        }));
        
        res.render('activities', { activities: translatedActivities, t: req.t, lang: req.language, currentFilter });
    } catch (error) {
        console.error('Erro ao buscar atividades:', error.response?.data || error.message);
        res.status(500).send('Erro ao buscar atividades do Strava.');
    }
});

app.get('/activity/:id', async (req, res) => {
    if (!userTokens.access_token) return res.redirect('/');
    try {
        const { activity, trackpoints } = await reFetchActivityData(req.params.id);
        const formattedDate = new Date(activity.start_date).toLocaleDateString(req.language, {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        res.render('activity_detail', { 
            activity, 
            trackpoints, 
            t: req.t, 
            lang: req.language,
            videoStartPoint: null, 
            errorMessage: null, 
            formattedDate, 
            formattedVideoDate: null
        });
    } catch (error) {
        console.error('Erro ao buscar streams:', error.response?.data || error.message);
        res.status(500).send('Erro ao carregar detalhes da atividade.');
    }
});

app.post('/activity/:id/upload', upload.single('videoFile'), async (req, res) => {
    if (!req.file) return res.status(400).send('Nenhum vídeo enviado.');

    const videoPath = req.file.path;
    const { id } = req.params;
    let formattedVideoDate = null;
    
    try {
        const { activity, trackpoints } = await reFetchActivityData(id);
        const formattedDate = new Date(activity.start_date).toLocaleDateString(req.language, {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const videoCreationTime = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) return reject(new Error('Não foi possível ler os metadados do vídeo.'));
                
                let creationTimeStr = metadata.format.tags?.creation_time || metadata.format.tags?.date;
                if (!creationTimeStr && metadata.streams) {
                    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                    if (videoStream && videoStream.tags) {
                        creationTimeStr = videoStream.tags.creation_time || videoStream.tags.date;
                    }
                }

                if (!creationTimeStr) return reject(new Error('O vídeo não contém metadados de data de criação.'));

                const hasTimezone = creationTimeStr.endsWith('Z') || /[\+\-]\d{2}:\d{2}$/.test(creationTimeStr);

                if (hasTimezone) {
                    // Se o vídeo já tem fuso horário, usamos diretamente
                    resolve(new Date(creationTimeStr));
                } else {
                    // CORREÇÃO: Trata a data do vídeo como local ao fuso da atividade
                    // 1. Parseamos a data do vídeo como se fosse UTC para capturar os valores numéricos
                    const videoTimeParsedAsUTC = new Date(creationTimeStr.replace(' ', 'T') + 'Z');
                    
                    // 2. Subtraímos o offset do Strava para converter o tempo local para o UTC correto
                    // Ex: Vídeo 17:00, offset -3h. O cálculo é 17:00 - (-3) = 20:00 UTC.
                    const correctedVideoTime = new Date(videoTimeParsedAsUTC.getTime() - (activity.utc_offset * 1000));
                    resolve(correctedVideoTime);
                }
            });
        });
        
        const activityTimezone = activity.timezone.split(' ')[1];
        formattedVideoDate = videoCreationTime.toLocaleString(req.language, {
            dateStyle: 'long',
            timeStyle: 'medium',
            timeZone: activityTimezone
        });

        const activityStartTime = new Date(activity.start_date);
        const activityEndTime = new Date(activityStartTime.getTime() + activity.elapsed_time * 1000);

        if (videoCreationTime < activityStartTime || videoCreationTime > activityEndTime) {
            fs.unlinkSync(videoPath);
            return res.render('activity_detail', {
                activity, trackpoints, t: req.t, lang: req.language,
                videoStartPoint: null,
                errorMessage: req.t.videoDateMismatchError,
                formattedDate,
                formattedVideoDate
            });
        }

        let closestPoint = null;
        let smallestDiff = Infinity;
        trackpoints.forEach(point => {
            const diff = Math.abs(point.time - videoCreationTime);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestPoint = point;
            }
        });
        
        fs.unlinkSync(videoPath);
        
        res.render('activity_detail', {
            activity, trackpoints, t: req.t, lang: req.language,
            videoStartPoint: closestPoint, errorMessage: null, formattedDate, formattedVideoDate
        });

    } catch (error) {
        fs.unlinkSync(videoPath);
        console.error("Erro no processamento do vídeo:", error.message);
        const { activity, trackpoints } = await reFetchActivityData(id);
        const formattedDate = new Date(activity.start_date).toLocaleDateString(req.language, {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        res.render('activity_detail', {
            activity, trackpoints, t: req.t, lang: req.language,
            videoStartPoint: null, errorMessage: error.message, formattedDate, formattedVideoDate
        });
    }
});

app.listen(port, () => console.log(`Aplicação a correr em http://localhost:${port}`));
