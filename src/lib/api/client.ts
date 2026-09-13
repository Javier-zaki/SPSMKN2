import type { User } from "firebase/auth";

export async function apiFetch<T = unknown>(
  firebaseUser: User,
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const idToken = await firebaseUser.getIdToken();
  const res = await fetch(url, {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Terjadi kesalahan");
  }
  return data as T;
}
