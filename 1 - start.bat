@echo off
TITLE StoriIA - Avvio Server in Rete Locale (LAN)
color 0B
echo ===============================================================================
echo                STORIIA - AVVIO SERVER IN RETE LOCALE (LAN)
echo ===============================================================================
echo.

echo [1/4] Rilevamento indirizzo IP locale della macchina...
set LOCAL_IP=127.0.0.1
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4 Address" /c:"Indirizzo IPv4"') do (
    for %%j in (%%i) do set LOCAL_IP=%%j
)
echo Indirizzo IP rilevato: %LOCAL_IP%
echo.

echo [Nota] Il file .env.local non verra' modificato automaticamente.
echo Assicurati di aver configurato manualmente in .env.local:
echo   NEXT_PUBLIC_SUPABASE_URL=http://%LOCAL_IP%:54321
echo   NEXT_PUBLIC_SUPABASE_ANON_KEY=^<la tua publishable key da Supabase Studio^>
echo.

echo [2/4] Avvio di Supabase locale in Docker...
call npx supabase start

echo.
echo ===============================================================================
echo   SUPABASE DOCKER ATTIVO!
echo   - API Gateway:    http://%LOCAL_IP%:54321
echo   - Supabase Studio: http://localhost:54323
echo ===============================================================================
echo.
echo [3/4] Avvio di Next.js Dev Server in una finestra indipendente...
echo.

start "StoriIA - Next.js Server (LAN 0.0.0.0:3000)" cmd /k "npm run dev -- -H 0.0.0.0 -p 3000"

echo.
echo [4/4] Avvio di Stripe CLI in una finestra indipendente per i Webhook...
echo.

start "StoriIA - Stripe Webhooks" cmd /k "stripe listen --forward-to localhost:3000/api/stripe/webhook"

echo ===============================================================================
echo   L'applicazione Next.js si sta avviando nella nuova finestra separata!
echo.
echo   Apri il browser sul tuo Tablet, Smartphone o PC all'indirizzo:
echo.
echo                       http://%LOCAL_IP%:3000
echo ===============================================================================
echo.
pause
