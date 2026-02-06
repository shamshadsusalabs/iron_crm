import merchAxios from '@/lib/merchAxios'
import useMerchAuthStore from '@/store/useMerchAuthStore'

const BASE = 'http://localhost:5000/api/follow-up'

function authHeaders() {
  const { user } = useMerchAuthStore.getState()
  const userId = user?.id
  return {
    ...(userId ? { 'x-user-id': userId } : {}),
    'x-role': 'merch',
  } as Record<string, string>
}

export type ContactPayload = {
  name: string
  email?: string
  phone?: string
  lists?: string[]
  tags?: string[]
  [key: string]: any
}

export type ContactDto = ContactPayload & { _id: string }

export const followUpContactsApi = {
  async list(params: { page?: number; limit?: number; search?: string } = {}) {
    const { data } = await merchAxios.get(`${BASE}/contacts`, {
      params,
      headers: authHeaders(),
    })
    return data
  },
  async create(payload: ContactPayload) {
    const { data } = await merchAxios.post(`${BASE}/contacts`, payload, {
      headers: authHeaders(),
    })
    return data
  },
  async update(id: string, payload: Partial<ContactPayload>) {
    const { data } = await merchAxios.put(`${BASE}/contacts/${id}`, payload, {
      headers: authHeaders(),
    })
    return data
  },
  async remove(id: string) {
    await merchAxios.delete(`${BASE}/contacts/${id}`, {
      headers: authHeaders(),
    })
  },
}

export const contactListsApi = {
  async list(params: { page?: number; limit?: number; search?: string } = {}) {
    const { data } = await merchAxios.get(`${BASE}/contact-lists`, {
      params,
      headers: authHeaders(),
    })
    return data
  },
  async create(payload: { name: string; description?: string }) {
    const { data } = await merchAxios.post(`${BASE}/contact-lists`, payload, {
      headers: authHeaders(),
    })
    return data
  },
  async update(listId: string, payload: Partial<{ name: string; description?: string }>) {
    const { data } = await merchAxios.put(`${BASE}/contact-lists/${listId}`, payload, {
      headers: authHeaders(),
    })
    return data
  },
  async remove(listId: string) {
    await merchAxios.delete(`${BASE}/contact-lists/${listId}`, {
      headers: authHeaders(),
    })
  },
}
