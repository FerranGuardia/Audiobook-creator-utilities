# Instrucciones para usar TTS

## Problema con las voces - SOLUCIONADO ✅

He corregido el problema con las voces. Ahora el sistema:

1. **Carga todas las voces en español** (no solo las de España)
   - Antes solo buscaba voces con `Locale == "es-ES"`
   - Ahora busca todas las voces que empiezan con `"es-"` (incluye es-AR, es-MX, es-CL, etc.)
   - Esto te da acceso a **45 voces en español** en lugar de solo 2

2. **Mejor manejo de errores**:
   - Muestra mensajes claros si el backend no está corriendo
   - Botón de "Reintentar" si no se cargan las voces
   - Mensajes de estado informativos

## Cómo iniciar el backend

### Opción 1: Usar el script .bat (Recomendado)
1. Abre una ventana de PowerShell o CMD
2. Navega a la carpeta del backend:
   ```powershell
   cd C:\Users\Nitropc\Desktop\Integration\backend
   ```
3. Ejecuta el script:
   ```powershell
   .\start_backend.bat
   ```

### Opción 2: Manualmente
1. Abre una ventana de PowerShell
2. Navega a la carpeta del backend:
   ```powershell
   cd C:\Users\Nitropc\Desktop\Integration\backend
   ```
3. Ejecuta:
   ```powershell
   python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

Deberías ver un mensaje como:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

## Cómo iniciar el frontend

1. Abre otra ventana de PowerShell
2. Navega a la carpeta del frontend:
   ```powershell
   cd C:\Users\Nitropc\Desktop\Integration\frontend
   ```
3. Ejecuta:
   ```powershell
   npm run dev
   ```

## Verificar que todo funciona

1. Abre tu navegador en `http://127.0.0.1:3000`
2. Haz clic en "TTS Solo"
3. Deberías ver:
   - Un mensaje: "✅ 45 voces en español cargadas" (o el número que corresponda)
   - Un dropdown con todas las voces disponibles
   - Si ves un error, verifica que el backend esté corriendo

## Solución de problemas

### Error: "Unable to connect to the remote server"
- **Causa**: El backend no está corriendo
- **Solución**: Inicia el backend usando una de las opciones arriba

### No se cargan las voces
- Verifica que el backend esté corriendo en `http://127.0.0.1:8000`
- Haz clic en el botón "🔄 Reintentar"
- Abre la consola del navegador (F12) para ver errores detallados

### Las voces aparecen vacías
- Verifica que `edge-tts` esté instalado: `pip install edge-tts`
- Reinicia el backend

