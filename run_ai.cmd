@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo First run setup.cmd once.
  pause
  exit /b 1
)
echo AI mode sends invoice PDFs to the configured OpenAI model and may incur API charges.
echo Set OPENAI_API_KEY and OPENAI_MODEL in your environment before proceeding.
choice /c YN /n /m "Send invoices to OpenAI now? Y/N: "
if errorlevel 2 exit /b 0
".venv\Scripts\python.exe" extract_invoices.py --mode ai
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "output\review.html"
pause
