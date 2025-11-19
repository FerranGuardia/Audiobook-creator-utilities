# 🎧 Audiobook Creator Utilities

Aplicación web completa para crear audiobooks profesionales desde webnovels. Combina scraping automático de capítulos con conversión de texto a voz (TTS) en un flujo integrado.

## ✨ Características

### 📥 Web Scraper
- Extracción automática de capítulos de webnovels
- Detección inteligente de URLs de capítulos
- Limpieza avanzada de texto
- Historial de URLs
- Importación de URLs desde archivo
- Guardado en batches (chunks)

### 🔊 Text-to-Speech (TTS)
- Múltiples voces disponibles (Edge TTS)
- Control de velocidad, tono y volumen
- Vista previa de audio
- Exportación a MP3
- Filtros por género y región

### 🚀 All in One Set Up
- **Flujo completamente automatizado**: Desde URL hasta archivo de audio
- **Procesamiento en cola**: Scrapea y convierte capítulos automáticamente
- **Batch processing**: Combina múltiples capítulos en archivos de audio
- **Progreso en tiempo real**: Monitorea el proceso paso a paso
- **Control total**: Pausa, reanuda o detén el procesamiento
- **Ideal para novelas largas**: Procesa cientos de capítulos sin intervención manual

## 🏗️ Arquitectura

- **Backend**: FastAPI (Python) - API REST para scraping y TTS
- **Frontend**: React + Vite - Interfaz moderna y responsive
- **TTS Engine**: Edge TTS (Microsoft)
- **Scraping**: CloudScraper + BeautifulSoup

## 📋 Requisitos

### Backend
- Python 3.8+
- pip

### Frontend
- Node.js 16+
- npm o yarn

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/audiobook-creator.git
cd audiobook-creator
```

### 2. Configurar Backend

```bash
cd backend
pip install -r requirements.txt
```

**Nota**: Para combinar archivos de audio, instala `pydub`:
```bash
pip install pydub
```

### 3. Configurar Frontend

```bash
cd frontend
npm install
```

## 🎮 Uso

### Iniciar Backend

```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

O usa el script batch:
```bash
start_backend.bat
```

El backend estará disponible en: `http://127.0.0.1:8000`

### Iniciar Frontend

```bash
cd frontend
npm run dev
```

El frontend estará disponible en: `http://127.0.0.1:3000`

## 📖 Guía de Uso

### Opción 1: Scraper Individual
1. Haz clic en **"Scraper"**
2. Ingresa la URL base y URL de inicio
3. Configura el rango de capítulos
4. Haz clic en **"Start Scraping"**
5. Descarga o copia los capítulos extraídos

### Opción 2: TTS Individual
1. Haz clic en **"TTS"**
2. Selecciona una voz
3. Pega el texto a convertir
4. Ajusta velocidad, tono y volumen (opcional)
5. Haz clic en **"Generate Audio"**

### Opción 3: All in One (Recomendado) ⭐
1. Haz clic en **"All in One Set Up"**
2. Configura:
   - URLs (base y start)
   - Rango de capítulos (ej: 1-390)
   - Batch size (capítulos por archivo de audio)
   - Voz TTS y ajustes
3. Haz clic en **"Start Processing"**
4. El sistema automáticamente:
   - Scrapea cada capítulo
   - Convierte a audio
   - Combina en batches
   - Genera archivos listos para descargar

## 🎯 Ejemplo de Uso

Para procesar una novela completa (ej: 390 capítulos):

1. **URL Base**: `https://novelbin.com/`
2. **URL Inicio**: `https://novelbin.com/b/naruto-uchihas-unserious-saga#tab-chapters-title`
3. **Rango**: Capítulos 1 a 390
4. **Batch Size**: 10 (generará ~39 archivos de audio)
5. **Voz**: Selecciona tu voz preferida

El sistema procesará todo automáticamente y generará archivos como:
- `batch_1_chapters_1_to_10.mp3`
- `batch_2_chapters_11_to_20.mp3`
- etc.

## 📁 Estructura del Proyecto

```
Integration/
├── backend/
│   ├── main.py              # API FastAPI
│   ├── requirements.txt     # Dependencias Python
│   ├── start_backend.bat    # Script de inicio
│   └── output/              # Archivos generados
│       └── audio/           # Archivos de audio
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Componente principal
│   │   └── components/
│   │       ├── ScraperView.jsx
│   │       ├── TTSView.jsx
│   │       └── AllInOneView.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🔧 API Endpoints

### Scraper
- `POST /api/scrape` - Scrapear capítulos
- `POST /api/get-chapter-urls` - Obtener URLs de capítulos
- `POST /api/scrape-single` - Scrapear un capítulo
- `POST /api/save-chapters-batch` - Guardar capítulos en batches

### TTS
- `GET /api/voices` - Listar voces disponibles
- `POST /api/generate` - Generar audio desde texto

### All in One
- `POST /api/process-all-in-one` - Iniciar procesamiento
- `GET /api/process-status` - Estado del procesamiento
- `POST /api/process-pause` - Pausar procesamiento
- `POST /api/process-resume` - Reanudar procesamiento
- `POST /api/process-stop` - Detener procesamiento
- `GET /api/list-audio-files` - Listar archivos generados
- `GET /api/download-audio/{filename}` - Descargar archivo

## 🛠️ Tecnologías

- **Backend**: FastAPI, Edge TTS, CloudScraper, BeautifulSoup, Pydub
- **Frontend**: React, Vite, CSS3
- **Deployment**: Local (desarrollo)

## 📝 Notas

- El procesamiento de muchos capítulos puede tomar tiempo considerable
- Los archivos de audio se guardan en `backend/output/audio/`
- El historial de URLs se guarda en localStorage del navegador
- Para mejor calidad de audio combinado, instala `pydub`

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo LICENSE para más detalles.

## 🙏 Agradecimientos

- Edge TTS por el servicio de texto a voz
- FastAPI por el framework web
- React por la biblioteca de UI

---

**Desarrollado con ❤️ para crear audiobooks de forma automatizada**
