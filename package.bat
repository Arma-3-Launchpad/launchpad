@echo off
setlocal
cd /d "%~dp0"
echo DEPRECATED: use  python package.py build
python "%~dp0package.py" build
exit /b %ERRORLEVEL%
