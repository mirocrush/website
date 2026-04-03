import axios from 'axios';

const BASE = '/api/profiles';
const cfg  = { withCredentials: true };

export const listProfiles   = ()           => axios.get(BASE, cfg);
export const createProfile  = (data)       => axios.post(`${BASE}/create`, data, cfg);
export const updateProfile  = (data)       => axios.post(`${BASE}/update`, data, cfg);
export const deleteProfile  = (id)         => axios.post(`${BASE}/delete`, { id }, cfg);
export const deletePicture  = (id)         => axios.post(`${BASE}/delete-picture`, { id }, cfg);

export const uploadPicture = (id, file) => {
  const fd = new FormData();
  fd.append('id', id);
  fd.append('picture', file);
  return axios.post(`${BASE}/upload-picture`, fd, { withCredentials: true });
};
