// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const API_ENDPOINTS = {
  AUTH: {
    SIGNUP: `${API_BASE_URL}/api/auth/signup`,
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    REFRESH: `${API_BASE_URL}/api/auth/refresh`,
    LOGOUT: `${API_BASE_URL}/api/auth/logout`,
    GOOGLE: `${API_BASE_URL}/api/auth/google`,
  },
  USERS: {
    PROFILE: `${API_BASE_URL}/api/users/me`,
    UPDATE: `${API_BASE_URL}/api/users/me`,
    PASSWORD: `${API_BASE_URL}/api/users/me/password`,
    DELETE: `${API_BASE_URL}/api/users/me`,
    UPLOAD: `${API_BASE_URL}/api/users/upload`,
    THEME: `${API_BASE_URL}/api/users/theme`,
  },
};

export default API_BASE_URL;
