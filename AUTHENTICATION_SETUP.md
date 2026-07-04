# GeoSecure Authentication Integration Guide

## Setup Complete ✅

### Backend Configuration

**File:** `backend/.env`

Your environment variables are already configured:
- ✅ DATABASE_URL: PostgreSQL (Neon) connection
- ✅ FRONTEND_URL: http://localhost:5173
- ✅ JWT_ACCESS_SECRET & JWT_REFRESH_SECRET: Configured
- ✅ Google OAuth: Configured
- ✅ Cloudinary: Configured

**Database Schema:**
- User table with fields: id, name, email, password, isVerified, refreshToken, imageUrl, authProvider, googleId, createdAt

**API Endpoints:**
- POST `/api/auth/signup` - Register new user
- POST `/api/auth/login` - Login user
- POST `/api/auth/refresh` - Refresh access token
- POST `/api/auth/logout` - Logout user (requires auth)
- GET `/api/auth/google` - Google OAuth initialization
- GET `/api/auth/google/callback` - Google OAuth callback

### Frontend Configuration

**File:** `frontend/.env`

```
VITE_API_URL=http://localhost:3000
```

**API Configuration:** `frontend/src/config/api.js`

All frontend API calls now use centralized configuration with environment variable support.

### Authentication Flow

**Signup:**
1. User fills form (firstName, lastName, email, password)
2. Frontend validates password: 8+ chars, uppercase, lowercase, special char
3. FirstName + LastName combined into "name" field
4. POST to `/api/auth/signup` with: name, email, password
5. Backend creates user in PostgreSQL
6. Returns accessToken (stored in localStorage) and refreshToken (httpOnly cookie)
7. User redirected to home page

**Login:**
1. User enters email and password
2. POST to `/api/auth/login`
3. Backend verifies credentials against PostgreSQL
4. Returns accessToken and refreshToken
5. User redirected to home page

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run start
# Server runs on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

### Testing the Connection

1. **Signup Flow:**
   - Go to http://localhost:5173/signup
   - Fill form with valid data:
     - First Name: John
     - Last Name: Doe
     - Email: john@example.com
     - Password: SecurePass123! (requires uppercase, lowercase, special char)
   - Check database: User created in PostgreSQL

2. **Login Flow:**
   - Go to http://localhost:5173/login
   - Use credentials from signup
   - Verify token stored in localStorage

3. **Database Verification:**
   ```bash
   # Check user in database using Prisma Studio
   cd backend
   npx prisma studio
   ```

### Password Requirements

Both frontend and backend validate passwords:
- ✅ Minimum 8 characters
- ✅ At least one uppercase letter (A-Z)
- ✅ At least one lowercase letter (a-z)
- ✅ At least one special character (!@#$%^&* etc.)

### CORS Configuration

- Frontend URL: http://localhost:5173
- Backend CORS enabled with credentials: true
- Cookies will be sent with requests

### Token Management

- **Access Token:** Short-lived (verify in backend)
- **Refresh Token:** Long-lived, stored as httpOnly cookie
- **Refresh Endpoint:** `/api/auth/refresh` (auto-refresh on token expiration)

### Environment Variables Reference

**Backend (.env):**
- `PORT`: 3000
- `DATABASE_URL`: PostgreSQL connection string
- `FRONTEND_URL`: http://localhost:5173
- `JWT_ACCESS_SECRET`: Secret for access tokens
- `JWT_REFRESH_SECRET`: Secret for refresh tokens
- `GOOGLE_CLIENT_ID`: OAuth client ID
- `GOOGLE_CLIENT_SECRET`: OAuth client secret
- `GOOGLE_CALLBACK_URL`: OAuth callback URL

**Frontend (.env):**
- `VITE_API_URL`: http://localhost:3000 (backend API URL)

### Troubleshooting

**Issue:** CORS error
- **Solution:** Verify FRONTEND_URL in backend/.env matches your frontend URL

**Issue:** Password validation fails
- **Solution:** Ensure password has uppercase, lowercase, and special character

**Issue:** Database connection error
- **Solution:** Verify DATABASE_URL in backend/.env is correct and database is accessible

**Issue:** Token not persisting
- **Solution:** Check browser's localStorage and cookies are enabled
