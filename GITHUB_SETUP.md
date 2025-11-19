# 🚀 Guía para Subir a GitHub

## Pasos para crear el repositorio en GitHub

### 1. Crear el repositorio en GitHub

1. Ve a [GitHub](https://github.com)
2. Haz clic en el botón **"+"** en la esquina superior derecha
3. Selecciona **"New repository"**
4. Completa:
   - **Repository name**: `audiobook-creator` (o el nombre que prefieras)
   - **Description**: "Aplicación web para crear audiobooks desde webnovels con scraping y TTS"
   - **Visibility**: Public o Private (tu elección)
   - **NO** marques "Initialize with README" (ya tenemos uno)
5. Haz clic en **"Create repository"**

### 2. Conectar el repositorio local con GitHub

Ejecuta estos comandos en la terminal (reemplaza `TU_USUARIO` con tu usuario de GitHub):

```bash
cd C:\Users\Nitropc\Desktop\Integration

# Hacer el commit inicial
git commit -m "Initial commit: Audiobook Creator Utilities"

# Agregar el remoto de GitHub (reemplaza TU_USUARIO con tu usuario)
git remote add origin https://github.com/TU_USUARIO/audiobook-creator.git

# Cambiar a la rama main (si es necesario)
git branch -M main

# Subir el código
git push -u origin main
```

### 3. Comandos Git útiles

```bash
# Ver el estado del repositorio
git status

# Agregar cambios
git add .

# Hacer commit
git commit -m "Descripción de los cambios"

# Subir cambios
git push

# Ver el historial
git log

# Crear una nueva rama
git checkout -b nombre-rama

# Volver a main
git checkout main
```

### 4. Estructura del repositorio

El repositorio incluye:
- ✅ `.gitignore` - Archivos a ignorar
- ✅ `README.md` - Documentación completa
- ✅ `LICENSE` - Licencia MIT
- ✅ `backend/` - Código del backend (FastAPI)
- ✅ `frontend/` - Código del frontend (React)
- ✅ Archivos de configuración

### 5. Notas importantes

- Los archivos en `node_modules/` y `__pycache__/` están excluidos por `.gitignore`
- Los archivos generados (audio, texto) también están excluidos
- El historial de URLs en localStorage no se sube (es local del navegador)

### 6. Actualizar el README

Si quieres personalizar el README, edita `README.md` antes de hacer el commit inicial.

---

**¡Listo!** Tu proyecto estará disponible en GitHub y podrás compartirlo con otros desarrolladores.

