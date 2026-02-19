import axios from 'axios';

const BASE = '/api/channels';
const post = (ep, data = {}) => axios.post(`${BASE}${ep}`, data).then((r) => r.data);

export const listChannels  = (payload) => post('/list',   payload);
export const createChannel = (payload) => post('/create', payload);
