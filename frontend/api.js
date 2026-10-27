import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  withCredentials: true
});

export async function api(path, options = {}) {
  try {
    const response = await client.request({
      url: path,
      method: options.method || 'GET',
      data: options.data ?? options.body
    });
    return response.data;
  } catch (error) {
    const normalized = new Error(error.response?.data?.error || error.message || 'The request failed.');
    normalized.status = error.response?.status;
    throw normalized;
  }
}

export const json = (method, data) => ({ method, data });
