@echo off
setlocal
cd /d "%~dp0"
python package.py %*
exit /b %ERRORLEVEL%
