@echo off
setlocal
cd ..
python util.py --build
cd scripts
exit /b %ERRORLEVEL%
