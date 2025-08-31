const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');

/**
 * Serviço para geração de overlays dinâmicos
 * Aplica SRP - responsável apenas pela criação de overlays
 */
class OverlayService {
    constructor() {
        this.logger = new Logger('OverlayService');
        this.overlayDir = 'overlays';
        this._ensureOverlayDirectory();
    }

    /**
     * Gera sequence de overlays para uma atividade
     * @param {Array} trackpoints - Pontos GPS com dados
     * @param {Object} activity - Dados da atividade
     * @returns {Promise<Object>} Informações dos overlays gerados
     */
    async generateOverlaySequence(trackpoints, activity) {
        try {
            // Prepara dados para overlay
            const overlayData = this._prepareOverlayData(trackpoints, activity);

            // Gera SVGs individuais
            const overlayFiles = [];
            for (let i = 0; i < overlayData.length; i++) {
                const fileName = `overlay_${activity.id}_${String(i).padStart(6, '0')}.svg`;
                const filePath = path.join(this.overlayDir, fileName);

                const svgContent = this._generateSVGOverlay(overlayData[i], overlayData);
                await fs.writeFile(filePath, svgContent);

                overlayFiles.push({
                    file: filePath,
                    timestamp: overlayData[i].timestamp,
                    index: i
                });
            }

            this.logger.info(`Generated ${overlayFiles.length} overlay files for activity ${activity.id}`);

            return {
                files: overlayFiles,
                totalFrames: overlayFiles.length,
                maxSpeed: Math.max(...overlayData.map(d => d.speed)),
                directory: this.overlayDir
            };
        } catch (error) {
            this.logger.error('Failed to generate overlay sequence:', error);
            throw new Error(`Overlay generation failed: ${error.message}`);
        }
    }

    /**
     * Prepara dados calculados para overlay
     * @private
     */
    _prepareOverlayData(trackpoints) {
        const data = [];
        let previousPoint = null;
        let totalElevationGain = 0;

        for (let i = 0; i < trackpoints.length; i++) {
            const point = trackpoints[i];
            if (!point.latlng || !point.time) continue;

            let speed = 0;
            let bearing = 0;
            let gForce = 0;
            let elevationGain = 0;

            if (previousPoint && previousPoint.latlng) {
                // Calcula velocidade (km/h)
                const distance = this._calculateDistance(
                    previousPoint.latlng[0], previousPoint.latlng[1],
                    point.latlng[0], point.latlng[1]
                );
                const timeDiff = (point.time - previousPoint.time) / 1000; // segundos
                if (timeDiff > 0) {
                    speed = (distance / timeDiff) * 3.6; // m/s para km/h
                }

                // Calcula direção/bearing
                bearing = this._calculateBearing(
                    previousPoint.latlng[0], previousPoint.latlng[1],
                    point.latlng[0], point.latlng[1]
                );

                // Calcula força G (mudança de velocidade)
                const prevSpeed = previousPoint.speed || 0;
                const acceleration = (speed - prevSpeed) / timeDiff;
                gForce = Math.abs(acceleration / 9.81); // G-force

                // Calcula ganho de elevação
                if (point.elevation !== undefined && previousPoint.elevation !== undefined) {
                    const elevDiff = point.elevation - previousPoint.elevation;
                    if (elevDiff > 0) {
                        elevationGain = elevDiff;
                        totalElevationGain += elevDiff;
                    }
                }
            }

            const dataPoint = {
                timestamp: point.time,
                speed: Math.round(speed * 10) / 10, // 1 casa decimal
                bearing: Math.round(bearing),
                gForce: Math.round(gForce * 100) / 100, // 2 casas decimais
                elevationGain: Math.round(elevationGain * 10) / 10,
                totalElevationGain: Math.round(totalElevationGain),
                coordinates: point.latlng,
                elevation: point.elevation || 0
            };

            data.push(dataPoint);
            dataPoint.speed = speed; // Store for next iteration
            previousPoint = { ...point, speed };
        }

        return data;
    }

    /**
     * Gera SVG do overlay para um ponto específico
     * @private
     */
    _generateSVGOverlay(dataPoint, allData) {
        const maxSpeed = Math.max(...allData.map(d => d.speed));
        const speedLimit = Math.ceil(maxSpeed / 10) * 10; // Próximo múltiplo de 10

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <!-- Gradientes e filtros -->
        <radialGradient id="backgroundGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(0,0,0,0.6)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0.9)"/>
        </radialGradient>

        <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#00ffff"/>
            <stop offset="50%" stop-color="#0080ff"/>
            <stop offset="100%" stop-color="#ff00ff"/>
        </linearGradient>

        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>

        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
    </defs>

    <!-- Fundo com transparência -->
    <rect width="400" height="300" fill="url(#backgroundGradient)" rx="20" opacity="0.8"/>

    <!-- Velocímetro principal -->
    <g transform="translate(150,120)">
        <!-- Círculo base do velocímetro -->
        <circle r="80" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>

        <!-- Marcações de velocidade -->
        ${this._generateSpeedMarks(speedLimit)}

        <!-- Borda de progresso da velocidade (azul neon) -->
        ${this._generateSpeedArc(dataPoint.speed, speedLimit)}

        <!-- Agulha da bússola (direção) -->
        ${this._generateCompassNeedle(dataPoint.bearing)}

        <!-- Centro do velocímetro -->
        <circle r="8" fill="#ff4444" filter="url(#glow)"/>
        <circle r="4" fill="#ffffff"/>
    </g>

    <!-- Display numérico da velocidade -->
    <g transform="translate(150,189)"> <!-- Era 195, agora 189 (6px acima) -->
        <rect x="-30" y="-15" width="60" height="30" rx="5"
            fill="rgba(0,0,0,0.8)"/> <!-- Removido: stroke="#00ffff" stroke-width="1" -->
        <text x="0" y="5" text-anchor="middle" font-family="Arial, monospace"
            font-size="16" font-weight="bold" fill="#00ffff" filter="url(#glow)">
            ${dataPoint.speed.toFixed(1)}
        </text>
        <text x="0" y="-20" text-anchor="middle" font-family="Arial"
            font-size="10" fill="#ffffff" opacity="0.8">
            km/h
        </text>
    </g>

    <!-- Círculo de Força G (canto superior esquerdo do velocímetro) -->
    <g transform="translate(50,80)">
        <circle r="25" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>

        <!-- Indicador de força G -->
        <circle r="20" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
        ${this._generateGForceIndicator(dataPoint.gForce)}

        <text x="0" y="-30" text-anchor="middle" font-family="Arial"
              font-size="8" fill="#ffffff" opacity="0.8">
            G-Force
        </text>
        <text x="0" y="5" text-anchor="middle" font-family="Arial, monospace"
              font-size="10" font-weight="bold" fill="#ffaa00">
            ${dataPoint.gForce.toFixed(2)}
        </text>
    </g>

    <!-- Círculo de Elevação (canto inferior esquerdo do velocímetro) -->
    <g transform="translate(50,160)">
        <circle r="25" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>

        <text x="0" y="-30" text-anchor="middle" font-family="Arial"
              font-size="8" fill="#ffffff" opacity="0.8">
            Elevation
        </text>
        <text x="0" y="0" text-anchor="middle" font-family="Arial, monospace"
              font-size="9" font-weight="bold" fill="#00ff00">
            ${dataPoint.totalElevationGain}m
        </text>
        <text x="0" y="12" text-anchor="middle" font-family="Arial"
              font-size="7" fill="#00ff00" opacity="0.7">
            +${dataPoint.elevationGain.toFixed(1)}
        </text>
    </g>

    <!-- Indicadores cardeais -->
    <g transform="translate(150,30)">
        <text x="0" y="0" text-anchor="middle" font-family="Arial"
              font-size="12" font-weight="bold" fill="#ffffff" filter="url(#shadow)">
            N
        </text>
    </g>
    <g transform="translate(150,220)">
        <text x="0" y="0" text-anchor="middle" font-family="Arial"
              font-size="12" font-weight="bold" fill="#ffffff" filter="url(#shadow)">
            S
        </text>
    </g>
    <g transform="translate(240,125)">
        <text x="0" y="0" text-anchor="middle" font-family="Arial"
              font-size="12" font-weight="bold" fill="#ffffff" filter="url(#shadow)">
            E
        </text>
    </g>
    <g transform="translate(60,125)">
        <text x="0" y="0" text-anchor="middle" font-family="Arial"
              font-size="12" font-weight="bold" fill="#ffffff" filter="url(#shadow)">
            W
        </text>
    </g>

    <!-- Timestamp (opcional, para debug) -->
    <text x="10" y="290" font-family="Arial" font-size="8" fill="rgba(255,255,255,0.5)">
        ${dataPoint.timestamp.toISOString().substr(11, 8)}
    </text>
</svg>`;
    }

    /**
     * Gera marcações de velocidade no velocímetro
     * @private
     */
    _generateSpeedMarks(speedLimit) {
        let marks = '';
        const totalAngle = 270; // 270 graus de -135 a +135
        const startAngle = -225; // Começa na parte inferior

        for (let speed = 0; speed <= speedLimit; speed += 10) {
            const angle = startAngle + (speed / speedLimit) * totalAngle;
            const radians = (angle * Math.PI) / 180;

            const x1 = Math.cos(radians) * 75;
            const y1 = Math.sin(radians) * 75;
            const x2 = Math.cos(radians) * 85;
            const y2 = Math.sin(radians) * 85;

            marks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                           stroke="#ffffff" stroke-width="2" opacity="0.8"/>`;

            // Números das velocidades
            const textX = Math.cos(radians) * 65;
            const textY = Math.sin(radians) * 65;
            marks += `<text x="${textX}" y="${textY}" text-anchor="middle"
                           font-family="Arial" font-size="10" fill="#ffffff"
                           opacity="0.7">${speed}</text>`;
        }

        return marks;
    }

    /**
     * Gera arco de progresso da velocidade
     * @private
     */
    _generateSpeedArc(currentSpeed, speedLimit) {
        const totalAngle = 270;
        const startAngle = -225;
        const currentAngle = startAngle + (currentSpeed / speedLimit) * totalAngle;

        if (currentSpeed <= 0) return '';

        // Calcular cor baseada na velocidade (0-100% da velocidade máxima)
        const speedPercent = currentSpeed / speedLimit;
        let color;

        if (speedPercent <= 0.33) {
        // Azul para ciano (0-33%)
            const ratio = speedPercent / 0.33;
            color = `rgb(${Math.round(0 + ratio * 0)}, ${Math.round(255 * (1 + ratio * 0.5))}, 255)`;
        } else if (speedPercent <= 0.66) {
        // Ciano para amarelo (33-66%)
            const ratio = (speedPercent - 0.33) / 0.33;
            color = `rgb(${Math.round(ratio * 255)}, 255, ${Math.round(255 * (1 - ratio))})`;
        } else {
        // Amarelo para vermelho (66-100%)
            const ratio = (speedPercent - 0.66) / 0.34;
            color = `rgb(255, ${Math.round(255 * (1 - ratio))}, 0)`;
        }

        const startRadians = (startAngle * Math.PI) / 180;
        const endRadians = (currentAngle * Math.PI) / 180;

        const x1 = Math.cos(startRadians) * 80;
        const y1 = Math.sin(startRadians) * 80;
        const x2 = Math.cos(endRadians) * 80;
        const y2 = Math.sin(endRadians) * 80;

        const largeArcFlag = (currentAngle - startAngle) > 180 ? 1 : 0;

        return `<path d="M ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}"
                  fill="none" stroke="${color}" stroke-width="6"
                  opacity="0.9" filter="url(#glow)" stroke-linecap="round"/>`;
    }

    /**
     * Gera agulha da bússola
     * @private
     */
    _generateCompassNeedle(bearing) {
        const angle = bearing - 90; // Ajusta para que 0° seja norte
        const radians = (angle * Math.PI) / 180;

        // Dimensões da agulha triangular
        const needleLength = 45;
        const needleWidth = 8;

        // Ponta da agulha (norte)
        const tipX = Math.cos(radians) * needleLength;
        const tipY = Math.sin(radians) * needleLength;

        // Base da agulha (perpendicular à direção)
        const baseAngle1 = radians + Math.PI / 2;
        const baseAngle2 = radians - Math.PI / 2;

        const base1X = Math.cos(baseAngle1) * needleWidth;
        const base1Y = Math.sin(baseAngle1) * needleWidth;
        const base2X = Math.cos(baseAngle2) * needleWidth;
        const base2Y = Math.sin(baseAngle2) * needleWidth;

        // Parte traseira (sul) - menor
        const tailLength = 15;
        const tailX = Math.cos(radians + Math.PI) * tailLength;
        const tailY = Math.sin(radians + Math.PI) * tailLength;

        return `
        <!-- Agulha triangular vermelha (norte) -->
        <polygon points="${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}"
                 fill="#ff4444" stroke="#ffffff" stroke-width="1" filter="url(#glow)"/>

        <!-- Cauda branca (sul) -->
        <polygon points="${tailX},${tailY} ${base1X / 2},${base1Y / 2} ${base2X / 2},${base2Y / 2}"
                 fill="#ffffff" stroke="#cccccc" stroke-width="1" opacity="0.9"/>

        <!-- Centro da bússola -->
        <circle r="3" fill="#333333" stroke="#ffffff" stroke-width="1"/>
    `;
    }

    /**
     * Gera indicador de força G
     * @private
     */
    _generateGForceIndicator() {
        return '';
    }

    /**
     * Calcula distância entre dois pontos GPS (Haversine)
     * @private
     */
    _calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Raio da Terra em metros
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Calcula bearing entre dois pontos GPS
     * @private
     */
    _calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const lat1Rad = (lat1 * Math.PI) / 180;
        const lat2Rad = (lat2 * Math.PI) / 180;

        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

        const bearing = (Math.atan2(y, x) * 180) / Math.PI;
        return (bearing + 360) % 360;
    }

    /**
     * Limpa arquivos de overlay antigos
     */
    async cleanupOverlays(activityId) {
        try {
            const files = await fs.readdir(this.overlayDir);
            const overlayFiles = files.filter(file =>
                file.startsWith(`overlay_${activityId}_`) && file.endsWith('.svg')
            );

            await Promise.all(overlayFiles.map(file =>
                fs.unlink(path.join(this.overlayDir, file))
            ));

            this.logger.info(`Cleaned up ${overlayFiles.length} overlay files for activity ${activityId}`);
        } catch (error) {
            this.logger.warn('Failed to cleanup overlay files:', error);
        }
    }

    async _ensureOverlayDirectory() {
        try {
            await fs.mkdir(this.overlayDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }
    }
}

module.exports = OverlayService;
