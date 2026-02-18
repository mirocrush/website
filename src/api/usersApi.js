import axios from 'axios';

const post = (endpoint, data = {}) =>
  axios.post(`/api/users${endpoint}`, data).then((res) => res.data);

export const getUserProfile = (username) => post('/profile', { username });
