#!/bin/bash
# GeoSecure Authentication Verification Script

echo "🔐 GeoSecure Authentication Setup Verification"
echo "=============================================="
echo ""

echo "1️⃣  Checking Backend Configuration..."
if [ -f "backend/.env" ]; then
    echo "   ✅ Backend .env file exists"
    echo "   📋 Environment Variables:"
    grep -E "DATABASE_URL|FRONTEND_URL|PORT|GOOGLE_CLIENT_ID" backend/.env | sed 's/^/      /'
else
    echo "   ❌ Backend .env file not found"
fi

echo ""
echo "2️⃣  Checking Frontend Configuration..."
if [ -f "frontend/.env" ]; then
    echo "   ✅ Frontend .env file exists"
    echo "   📋 Environment Variables:"
    cat frontend/.env | sed 's/^/      /'
else
    echo "   ⚠️  Frontend .env file not found (will use defaults)"
fi

echo ""
echo "3️⃣  Checking API Configuration..."
if [ -f "frontend/src/config/api.js" ]; then
    echo "   ✅ Frontend API config exists"
else
    echo "   ❌ Frontend API config not found"
fi

echo ""
echo "4️⃣  Checking Authentication Files..."
echo "   Backend:"
[ -f "backend/src/controllers/auth.controller.js" ] && echo "      ✅ Auth controller" || echo "      ❌ Auth controller"
[ -f "backend/src/routes/auth.routes.js" ] && echo "      ✅ Auth routes" || echo "      ❌ Auth routes"
[ -f "backend/src/validation/auth.validation.js" ] && echo "      ✅ Auth validation" || echo "      ❌ Auth validation"
[ -f "backend/src/utils/token.util.js" ] && echo "      ✅ Token utilities" || echo "      ❌ Token utilities"

echo ""
echo "   Frontend:"
[ -f "frontend/src/Login.jsx" ] && echo "      ✅ Login component" || echo "      ❌ Login component"
[ -f "frontend/src/Signup.jsx" ] && echo "      ✅ Signup component" || echo "      ❌ Signup component"
[ -f "frontend/src/App.jsx" ] && echo "      ✅ App router" || echo "      ❌ App router"

echo ""
echo "=============================================="
echo "✨ Setup Verification Complete!"
echo ""
echo "Next Steps:"
echo "1. Start Backend:  cd backend && npm run dev"
echo "2. Start Frontend: cd frontend && npm run dev"
echo "3. Test at:       http://localhost:5173/signup"
