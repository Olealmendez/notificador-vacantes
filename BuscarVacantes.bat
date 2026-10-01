@echo off
setlocal EnableDelayedExpansion

rem ---------------------------------------------------------------
rem  Si copiaste este archivo a otra carpeta (por ejemplo al Escritorio),
rem  crea al lado un archivo llamado "ruta.txt" con la ruta completa
rem  de la carpeta del programa. Ese archivo no se publica en GitHub.
rem ---------------------------------------------------------------

set "PROYECTO=%~dp0"

if not exist "%PROYECTO%index.js" (
  if exist "%~dp0ruta.txt" (
    set /p RUTA=<"%~dp0ruta.txt"
    set "PROYECTO=!RUTA!"
  )
)

if not "%PROYECTO:~-1%"=="\" set "PROYECTO=%PROYECTO%\"

if not exist "%PROYECTO%index.js" (
  echo.
  echo ============================================================
  echo   PROBLEMA
  echo ============================================================
  echo.
  echo   No se encontro la carpeta del programa.
  echo.
  echo   Si copiaste este archivo a otra carpeta, crea a su lado
  echo   un archivo "ruta.txt" con la ruta de la carpeta del
  echo   programa, por ejemplo:
  echo.
  echo   C:\ruta\a\notificador-vacantes
  echo.
  echo   Pide ayuda a la persona que configuro esto.
  echo.
  goto fin
)

cd /d "%PROYECTO%"

echo ============================================================
echo    BUSQUEDA DE VACANTES DE MUSICA - MEP
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo PROBLEMA: No se encontro Node.js en esta computadora.
  echo.
  echo Pide ayuda a la persona que configuro este programa.
  goto fin
)

echo Iniciando la busqueda. Tarda unos 10 segundos.
echo Al terminar se guardara todo en vistos.json
echo y te llegara un correo si hay algo nuevo.
echo.
echo ------------------------------------------------------------
echo.

node index.js
set CODIGO=%ERRORLEVEL%

echo.
echo ------------------------------------------------------------
echo.

if "%CODIGO%"=="0" (
  echo LISTO. Revisa tu correo por si hay alguna vacante nueva.
) else (
  echo ALGO NO SALIO BIEN.
  echo.
  echo Copia el texto que aparece arriba y mandaselo a la
  echo persona que configuro este programa.
)

:fin
echo.
echo Presiona cualquier tecla para cerrar esta ventana.
pause >nul
