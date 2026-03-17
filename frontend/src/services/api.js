import axios from "axios";

import { getAuthToken } from "../utils/auth";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL,
  timeout: 20000
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function registerUser(payload) {
  const { data } = await api.post("/api/auth/register", payload);
  return data;
}

export async function loginUser(payload) {
  const { data } = await api.post("/api/auth/login", payload);
  return data;
}

export async function getDocuments() {
  const { data } = await api.get("/api/docs");
  return data;
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/api/docs/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
}

export async function getDocumentUrl(docId, version = "original", download = false) {
  const { data } = await api.get(`/api/docs/${docId}/url`, { params: { version, download } });
  return data;
}

export async function deleteDocument(docId) {
  const { data } = await api.delete(`/api/docs/${docId}`);
  return data;
}

export async function createSignature(payload) {
  const { data } = await api.post("/api/signatures", payload);
  return data;
}

export async function finalizeDocument(docId) {
  const { data } = await api.post("/api/signatures/finalize", { doc_id: docId });
  return data;
}
