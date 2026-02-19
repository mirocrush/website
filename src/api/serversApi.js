import axios from 'axios';

const BASE = '/api/servers';
const post = (ep, data = {}) => axios.post(`${BASE}${ep}`, data).then((r) => r.data);

export const createServer      = (payload)  => post('/create',      payload);
export const listServers       = ()         => post('/list');
export const leaveServer       = (payload)  => post('/leave',       payload);
export const deleteServer      = (payload)  => post('/delete',      payload);
export const discoverServers   = (payload)  => post('/discover',    payload);
export const getServerByInvite = (payload)  => post('/invite-info', payload);
export const joinServer        = (payload)  => post('/join',        payload);
export const listServerMembers = (payload)  => post('/members',     payload);
export const kickMember        = (payload)  => post('/kick',        payload);
export const banMember         = (payload)  => post('/ban',         payload);
export const muteMember        = (payload)  => post('/mute',        payload);

// Multipart — for updating server name and/or icon
export const updateServer = (formData) =>
  axios.post(`${BASE}/update`, formData, {
    withCredentials: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
