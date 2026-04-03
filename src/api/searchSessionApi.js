import axios from 'axios';

const BASE = '/api/search-session';
const cfg  = { withCredentials: true };

export const getSession    = ()     => axios.get(BASE, cfg);
export const updateSession = (data) => axios.put(BASE, data, cfg);
export const clearSession  = ()     => axios.delete(BASE, cfg);
