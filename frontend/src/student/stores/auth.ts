import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@shared/api/client';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('studentToken'));
  const isLoggedIn = computed(() => !!token.value);

  async function login(studentId: string, password: string) {
    const data = await api<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ studentId, password }),
    });
    token.value = data.token;
    localStorage.setItem('studentToken', data.token);
  }

  async function register(studentId: string, password: string, name: string) {
    const data = await api<{ apiKey: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ studentId, password, name }),
    });
    return data.apiKey;
  }

  function logout() {
    token.value = null;
    localStorage.removeItem('studentToken');
  }

  return { token, isLoggedIn, login, register, logout };
});
