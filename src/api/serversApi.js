import axios from 'axios';

const BASE = '/api/servers';
const post = (ep, data = {}) => axios.post(`${BASE}${ep}`, data).then((r) => r.data);

export const createServer = (payload) => post('/create', payload);
export const listServers  = ()        => post('/list');
export const leaveServer  = (payload) => post('/leave', payload);
