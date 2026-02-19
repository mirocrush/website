import axios from 'axios';

const BASE = '/api/messages';
const post = (ep, data = {}) => axios.post(`${BASE}${ep}`, data).then((r) => r.data);

export const listMessages  = (payload) => post('/list',   payload);
export const sendMessage   = (payload) => post('/send',   payload);
export const editMessage   = (payload) => post('/edit',   payload);
export const deleteMessage = (payload) => post('/delete', payload);
