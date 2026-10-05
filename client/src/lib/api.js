import axios from "axios";

const configuredBaseURL = import.meta.env.DEV
  ? import.meta.env.VITE_API_DEV_URL
  : import.meta.env.VITE_API_URL;

if (!configuredBaseURL) {
  throw new Error("Missing API URL. Set VITE_API_URL in the production client environment.");
}

const baseURL = configuredBaseURL.replace(/\/$/, "");

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
