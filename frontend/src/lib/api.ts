const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.detail || "API request failed");
  }
  return res.json();
}

// Dashboard
export const getDashboard = () => fetchAPI<any>("/api/dashboard/");

// Topics
export const getTopics = () => fetchAPI<any[]>("/api/topics/");
export const getTopic = (id: string) => fetchAPI<any>(`/api/topics/${id}`);
export const createTopic = (data: { name: string; keywords: string[]; platforms?: string[] }) =>
  fetchAPI<any>("/api/topics/", { method: "POST", body: JSON.stringify(data) });
export const deleteTopic = (id: string) =>
  fetchAPI<void>(`/api/topics/${id}`, { method: "DELETE" });
export const getTopicPosts = (id: string, params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return fetchAPI<any>(`/api/topics/${id}/posts${qs}`);
};
export const getTopicTimeline = (id: string, hours?: number) =>
  fetchAPI<any[]>(`/api/topics/${id}/timeline${hours ? `?hours=${hours}` : ""}`);

// Posts
export const searchPosts = (q: string) => fetchAPI<any[]>(`/api/posts/search?q=${encodeURIComponent(q)}`);
export const semanticSearch = (q: string) => fetchAPI<any[]>(`/api/posts/semantic-search?q=${encodeURIComponent(q)}`);
