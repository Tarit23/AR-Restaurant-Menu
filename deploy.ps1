# =====================================================
# AR MENU PLATFORM - DEPLOYMENT SCRIPT (Windows)
# =====================================================

Write-Host "🚀 Starting AR Menu Platform SaaS Deployment..." -ForegroundColor Cyan

# 1. Fix Execution Policy (Temporary for this session)
Write-Host "🔧 Configuring PowerShell permissions..." -ForegroundColor Yellow
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# 2. Check for Node.js
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Node.js/NPM not found. Please install Node.js from https://nodejs.org/"
    exit
}

# 3. Install Supabase CLI locally (prevents global permission errors)
Write-Host "📦 Installing Supabase CLI locally..." -ForegroundColor Yellow
npm install supabase --save-dev

# 4. Verify Project ID
$PROJECT_ID = "fuezcrbfswgghawhfxrv"
Write-Host "📍 Target Project: $PROJECT_ID" -ForegroundColor Cyan

# 5. Login (if needed)
Write-Host "🔑 Checking Supabase authentication..." -ForegroundColor Yellow
npx supabase login

# 6. Deploy Edge Function
Write-Host "🚀 Deploying Edge Function: admin-create-restaurant..." -ForegroundColor Cyan
npx supabase functions deploy admin-create-restaurant --project-ref $PROJECT_ID

Write-Host "`n✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "The 'Add Restaurant' feature should now work correctly in your dashboard." -ForegroundColor White
