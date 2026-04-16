# =====================================================
# AR MENU PLATFORM - DEPLOYMENT SCRIPT (Windows)
# =====================================================

Write-Host "--- Starting AR Menu Platform SaaS Deployment ---" -ForegroundColor Cyan

# 1. Fix Execution Policy
Write-Host "[1/7] Configuring PowerShell permissions..." -ForegroundColor Yellow
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# 2. Check for Node.js
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "ERR: Node.js/NPM not found. Please install Node.js from https://nodejs.org/"
    exit
}

# 3. Install Supabase CLI locally
Write-Host "[2/7] Installing Supabase CLI locally..." -ForegroundColor Yellow
npm install supabase --save-dev

# 4. Verify Project ID
$PROJECT_ID = "fuezcrbfswgghawhfxrv"
Write-Host "[3/7] Target Project: $PROJECT_ID" -ForegroundColor Cyan

# 5. Login
Write-Host "[4/7] Checking Supabase authentication..." -ForegroundColor Yellow
npx supabase login

# 6. Set Secrets
Write-Host ""
Write-Host "[5/7] Step: Configure Edge Function Secrets" -ForegroundColor Yellow
Write-Host "The Edge Function needs your Service Role Key to create restaurant accounts."
Write-Host "Find it at: https://supabase.com/dashboard/project/$PROJECT_ID/settings/api" -ForegroundColor Gray
$SERVICE_KEY = Read-Host "Paste your SERVICE_ROLE_KEY here (leave blank to skip)"

if ($SERVICE_KEY) {
    Write-Host "Setting secrets... (SERVICE_ROLE_KEY)" -ForegroundColor Cyan
    npx supabase secrets set "SERVICE_ROLE_KEY=$SERVICE_KEY" --project-ref $PROJECT_ID
} else {
    Write-Host "Skipping secrets. The Add Restaurant feature might fail if secrets aren't set." -ForegroundColor Gray
}

# 7. Deploy Edge Function
Write-Host ""
Write-Host "[6/7] Deploying Edge Function: admin-create-restaurant..." -ForegroundColor Cyan
npx supabase functions deploy admin-create-restaurant --project-ref $PROJECT_ID

Write-Host ""
Write-Host "[7/7] DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "The restaurant creation feature should now work correctly in your dashboard." -ForegroundColor White
