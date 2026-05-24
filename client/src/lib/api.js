import axios from "axios";

const baseURL = import.meta.env.VIT_NODE_ENV=="development" ? import.meta.env.VITE_API_DEV_URL : import.meta.env.VITE_API_URL;

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
