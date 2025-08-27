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
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de vídeo são permitidos.'), false);
        }
    }
});

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
        axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, { 
            headers: { 'Authorization': `Bearer ${userTokens.access_token}` } 
        }),
        axios.get(`https://www.strava.com/api/v3/activities/${activityId}/streams`, { 
            headers: { 'Authorization': `Bearer ${userTokens.access_token}` }, 
            params: { keys, key_by_type: true } 
        })
    ]);

    const activity = activityDetailsRes.data;
    const streams = streamsRes.data;
    
    // CORREÇÃO: Ajusta o start_date da atividade para o fuso horário local
    // O Strava retorna start_date em UTC, mas precisamos no fuso local da atividade
    const activityStartLocal = new Date(new Date(activity.start_date).getTime() + (activity.utc_offset * 1000));
    
    const trackpoints = (streams.time?.data || []).map((time, i) => ({
        latlng: streams.latlng?.data[i] || null,
        // Calcula o tempo de cada ponto baseado no início local + tempo decorrido
        time: new Date(activityStartLocal.getTime() + time * 1000),
    }));

    return { activity, trackpoints };
};

const extractVideoMetadata = (videoPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                return reject(new Error('Não foi possível ler os metadados do vídeo.'));
            }
            
            // Procura por data de criação em diferentes locais dos metadados
            let creationTimeStr = null;
            
            // Tenta format tags primeiro
            if (metadata.format && metadata.format.tags) {
                creationTimeStr = metadata.format.tags.creation_time || 
                                metadata.format.tags.date ||
                                metadata.format.tags.DATE ||
                                metadata.format.tags['creation-time'];
            }
            
            // Se não encontrou, tenta nos streams
            if (!creationTimeStr && metadata.streams) {
                for (const stream of metadata.streams) {
                    if (stream.tags) {
                        creationTimeStr = stream.tags.creation_time || 
                                        stream.tags.date ||
                                        stream.tags.DATE ||
                                        stream.tags['creation-time'];
                        if (creationTimeStr) break;
                    }
                }
            }

            if (!creationTimeStr) {
                return reject(new Error('O vídeo não contém metadados de data de criação válidos.'));
            }

            resolve({
                creationTime: creationTimeStr,
                duration: metadata.format.duration,
                size: metadata.format.size
            });
        });
    });
};

const parseVideoCreationTime = (creationTimeStr, activityTimezone, activityUtcOffset) => {
    // Verifica se já tem timezone
    const hasTimezone = creationTimeStr.endsWith('Z') || /[\+\-]\d{2}:?\d{2}$/.test(creationTimeStr);
    
    if (hasTimezone) {
        // Se o vídeo já tem timezone, usa diretamente - sem conversão adicional
        return new Date(creationTimeStr);
    } else {
        // Se não tem timezone, trata como local e converte para UTC
        const cleanTimeStr = creationTimeStr.replace(' ', 'T');
        
        // Cria data assumindo que é local, depois converte para UTC
        if (!cleanTimeStr.endsWith('Z')) {
            return new Date(cleanTimeStr + 'Z');
        }
        
        return new Date(cleanTimeStr);
    }
};

const findClosestTrackpoint = (trackpoints, videoTime) => {
    if (!trackpoints || trackpoints.length === 0) {
        return null;
    }
    
    let closestPoint = null;
    let smallestDiff = Infinity;
    
    trackpoints.forEach(point => {
        if (point.latlng && point.time) {
            const diff = Math.abs(point.time.getTime() - videoTime.getTime());
            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestPoint = point;
            }
        }
    });
    
    return closestPoint;
};

// -----------------------------------------------------------------------------
// Rotas da Aplicação
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
    res.render('index', { t: req.t, lang: req.language });
});

app.get('/authorize', (req, res) => {
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=read,activity:read_all`;
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    try {
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: CLIENT_ID, 
            client_secret: CLIENT_SECRET,
            code: req.query.code, 
            grant_type: 'authorization_code',
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
    
    // Verifica se o token expirou
    if (userTokens.expires_at && userTokens.expires_at < Date.now() / 1000) {
        try {
            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: CLIENT_ID, 
                client_secret: CLIENT_SECRET,
                grant_type: 'refresh_token', 
                refresh_token: userTokens.refresh_token,
            });
            userTokens = response.data;
        } catch (error) { 
            console.error('Erro ao renovar token:', error.response?.data || error.message);
            return res.redirect('/'); 
        }
    }

    try {
        const response = await axios.get(`https://www.strava.com/api/v3/athlete/activities`, {
            headers: { 'Authorization': `Bearer ${userTokens.access_token}` },
            params: { per_page: 30 }
        });
        
        const currentFilter = req.query.filter || 'gps';
        let activities = response.data;

        if (currentFilter === 'gps') {
            activities = activities.filter(activity => 
                activity.map && activity.map.summary_polyline && activity.map.summary_polyline.length > 0
            );
        }

        const translatedActivities = activities.map(activity => ({
            ...activity,
            translated_type: req.t[activity.type] || activity.type
        }));
        
        res.render('activities', { 
            activities: translatedActivities, 
            t: req.t, 
            lang: req.language, 
            currentFilter 
        });
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
    if (!req.file) {
        return res.status(400).send('Nenhum vídeo enviado.');
    }

    const videoPath = req.file.path;
    const { id } = req.params;
    let formattedVideoDate = null;
    
    try {
        const { activity, trackpoints } = await reFetchActivityData(id);
        const formattedDate = new Date(activity.start_date).toLocaleDateString(req.language, {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        // Extrai metadados do vídeo
        const videoMetadata = await extractVideoMetadata(videoPath);
        
        // Parse do tempo de criação do vídeo (sem alterações - é o tempo real)
        const videoCreationTime = parseVideoCreationTime(
            videoMetadata.creationTime, 
            activity.timezone, 
            activity.utc_offset
        );
        
        // CORREÇÃO: Formatar a data do vídeo sem conversões (é o tempo real)
        formattedVideoDate = videoCreationTime.toLocaleString(req.language, {
            dateStyle: 'long',
            timeStyle: 'medium'
        });

        // CORREÇÃO: Usa start_date ajustado para o fuso local da atividade
        const activityStartTimeLocal = new Date(new Date(activity.start_date).getTime() + (activity.utc_offset * 1000));
        const activityEndTimeLocal = new Date(activityStartTimeLocal.getTime() + (activity.elapsed_time * 1000));
        
        console.log('=== DEBUG TIMES ===');
        console.log('Activity Start (UTC original):', new Date(activity.start_date).toISOString());
        console.log('Activity Start (Local corrected):', activityStartTimeLocal.toISOString());
        console.log('Activity End (Local corrected):', activityEndTimeLocal.toISOString());
        console.log('Video Creation (Real time):', videoCreationTime.toISOString());
        console.log('Activity UTC Offset:', activity.utc_offset, 'seconds');
        console.log('Activity Timezone:', activity.timezone);
        console.log('Video Raw Metadata:', videoMetadata.creationTime);
        console.log('Formatted Video Date:', formattedVideoDate);
        console.log('Video dentro do intervalo:', videoCreationTime >= activityStartTimeLocal && videoCreationTime <= activityEndTimeLocal);

        // Valida se o vídeo está dentro do intervalo da atividade (ambos no mesmo referencial de tempo)
        if (videoCreationTime < activityStartTimeLocal || videoCreationTime > activityEndTimeLocal) {
            fs.unlinkSync(videoPath); // Remove arquivo temporário
            
            return res.render('activity_detail', {
                activity, 
                trackpoints, 
                t: req.t, 
                lang: req.language,
                videoStartPoint: null,
                errorMessage: req.t.videoDateMismatchError,
                formattedDate,
                formattedVideoDate
            });
        }

        // Encontra o ponto mais próximo ao horário do vídeo
        const closestPoint = findClosestTrackpoint(trackpoints, videoCreationTime);
        
        if (!closestPoint) {
            fs.unlinkSync(videoPath);
            return res.render('activity_detail', {
                activity, 
                trackpoints, 
                t: req.t, 
                lang: req.language,
                videoStartPoint: null,
                errorMessage: 'Não foi possível encontrar um ponto GPS correspondente ao horário do vídeo.',
                formattedDate,
                formattedVideoDate
            });
        }
        
        // Remove arquivo temporário
        fs.unlinkSync(videoPath);
        
        console.log('=== VIDEO SYNC SUCCESS ===');
        console.log('Closest point time (UTC):', closestPoint.time.toISOString());
        console.log('Video creation time (UTC):', videoCreationTime.toISOString());
        console.log('Closest point coordinates:', closestPoint.latlng);
        console.log('Time difference (ms):', Math.abs(closestPoint.time.getTime() - videoCreationTime.getTime()));
        console.log('Time difference (seconds):', Math.abs(closestPoint.time.getTime() - videoCreationTime.getTime()) / 1000);
        
        res.render('activity_detail', {
            activity, 
            trackpoints, 
            t: req.t, 
            lang: req.language,
            videoStartPoint: closestPoint, 
            errorMessage: null, 
            formattedDate, 
            formattedVideoDate
        });

    } catch (error) {
        // Limpa arquivo temporário em caso de erro
        if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
        }
        
        console.error("Erro no processamento do vídeo:", error.message);
        console.error("Stack trace:", error.stack);
        
        try {
            const { activity, trackpoints } = await reFetchActivityData(id);
            const formattedDate = new Date(activity.start_date).toLocaleDateString(req.language, {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            
            res.render('activity_detail', {
                activity, 
                trackpoints, 
                t: req.t, 
                lang: req.language,
                videoStartPoint: null, 
                errorMessage: error.message, 
                formattedDate, 
                formattedVideoDate
            });
        } catch (renderError) {
            console.error("Erro ao renderizar página de erro:", renderError);
            res.status(500).send('Erro interno do servidor.');
        }
    }
});

// Middleware de tratamento de erros do multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).send('Arquivo muito grande. Tamanho máximo: 500MB');
        }
    }
    
    if (error.message === 'Apenas arquivos de vídeo são permitidos.') {
        return res.status(400).send(error.message);
    }
    
    console.error('Erro não tratado:', error);
    res.status(500).send('Erro interno do servidor.');
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).send('Página não encontrada.');
});

app.listen(port, () => {
    console.log(`Aplicação a correr em http://localhost:${port}`);
    console.log(`Strava Client ID: ${CLIENT_ID}`);
    console.log(`Redirect URI: ${REDIRECT_URI}`);
});