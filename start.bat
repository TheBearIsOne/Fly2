@echo off
cd /d %~dp0
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:4173
  python -m http.server 4173
) else (
  echo Python не найден. Запустите любой статик-сервер из этой папки:
  echo   npx serve .
  echo   или расширение VS Code "Live Server"
  pause
)