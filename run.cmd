@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo First run setup.cmd once.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" extract_invoices.py --mode local
if errorlevel 1 goto failed
start "" "output\review.html"
echo Open output\invoices.csv for the combined line-item data.
pause
exit /b 0
:failed
echo Processing did not finish. Review the message above.
pause
exit /b 1
