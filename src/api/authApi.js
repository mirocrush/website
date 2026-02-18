import axios from 'axios';

const BASE = '/api/auth';

// All auth calls use POST only; credentials (cookies) are sent automatically
// because axios.defaults.withCredentials = true is set in src/index.js
const post = (endpoint, data = {}) =>
  axios.post(`${BASE}${endpoint}`, data).then((res) => res.data);

export const signup    = (payload) => post('/signup',     payload);
export const verifyOtp = (payload) => post('/verify-otp', payload);
export const signin    = (payload) => post('/signin',     payload);
export const signout   = ()        => post('/signout');
export const getMe     = ()        => post('/me');
