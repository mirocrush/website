import axios from 'axios';

const BASE = '/api/conversations';
const post = (ep, data = {}) => axios.post(`${BASE}${ep}`, data).then((r) => r.data);

export const listConversations = (payload) => post('/list',         payload);
export const fromChannel       = (payload) => post('/from-channel', payload);
export const markRead          = (payload) => post('/read',         payload);
