import axios from 'axios';

const BASE = '/api/channels';
const post = (ep, data = {}) => axios.post(`${BASE}${ep}`, data).then((r) => r.data);

export const listChannels    = (payload) => post('/list',   payload);
export const createChannel   = (payload) => post('/create', payload);
export const getChannelByKey = (payload) => post('/by-key', payload);
