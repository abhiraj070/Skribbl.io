import axios from "axios";

const configuredBaseURL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_DEV_URL;

if (!configuredBaseURL) {
  console.error("Missing API URL. Set VITE_API_URL or VITE_API_DEV_URL in the client environment.");
}

const baseURL = configuredBaseURL ? configuredBaseURL.replace(/\/$/, "") : "";

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
