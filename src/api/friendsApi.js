import axios from 'axios';

const BASE = '/api/friends';

const post = (endpoint, data = {}) =>
  axios.post(`${BASE}${endpoint}`, data).then((res) => res.data);

export const sendRequest      = (payload)  => post('/send',    payload);
export const respondToRequest = (payload)  => post('/respond', payload);
export const listRequests     = (type)     => post('/requests', { type });
export const listFriends      = ()         => post('/list');
export const removeFriend     = (friendId) => post('/remove',  { friendId });
export const getFriendStatus  = (payload)  => post('/status',  payload);
