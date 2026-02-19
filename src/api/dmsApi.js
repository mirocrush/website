import axios from 'axios';

const post = (ep, data = {}) => axios.post(`/api/dms${ep}`, data).then((r) => r.data);

export const upsertDm = (payload) => post('/upsert', payload);
