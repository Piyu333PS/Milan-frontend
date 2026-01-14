// lib/api/milan.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://your-backend-url/api/milan",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const searchMilanUsers = (q) => api.get(`/search?q=${q}`);
export const sendMilanRequest = (receiverId) => api.post(`/request`, { receiverId });
export const getMilanRequests = () => api.get(`/requests`);
export const acceptMilanRequest = (id) => api.post(`/accept/${id}`);
export const declineMilanRequest = (id) => api.post(`/decline/${id}`);
