import axios from 'axios';

const BASE = '/api/auth';

// All auth calls use POST only; credentials (cookies) are sent automatically
// because axios.defaults.withCredentials = true is set in src/index.js
const post = (endpoint, data = {}) =>
  axios.post(`${BASE}${endpoint}`, data).then((res) => res.data);

export const signup          = (payload) => post('/signup',           payload);
export const verifyOtp       = (payload) => post('/verify-otp',       payload);
export const signin          = (payload) => post('/signin',           payload);
export const signout         = ()        => post('/signout');
export const getMe           = ()        => post('/me');
export const checkUsername   = (payload) => post('/check-username',   payload);
export const changePassword    = (payload) => post('/change-password',    payload);
export const changeUsername    = (payload) => post('/change-username',    payload);
export const changeDisplayName = (payload) => post('/change-display-name', payload);
export const deleteAccount   = (payload) => post('/delete-account',   payload);

// Avatar — multipart/form-data, so we use axios directly
export const uploadAvatar = (formData) =>
  axios.post('/api/auth/upload-avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data);

export const deleteAvatar = () => post('/delete-avatar');
