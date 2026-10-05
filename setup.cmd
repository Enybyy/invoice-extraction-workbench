@echo off
cd /d "%~dp0"
python --version >nul 2>&1
if errorlevel 1 (
  echo Install Python from python.org and enable Add Python to PATH, then run setup again.
  pause
  exit /b 1
)
python -m venv .venv
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto failed
echo Setup complete. Place your PDF files in inputs, then double-click run.cmd.
pause
exit /b 0
:failed
echo Setup did not finish. Review the message above.
pause
exit /b 1
