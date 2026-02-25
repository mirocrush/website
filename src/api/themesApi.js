import axios from 'axios';

export const listThemes = () =>
  axios.get('/api/themes/list').then((r) => r.data);
