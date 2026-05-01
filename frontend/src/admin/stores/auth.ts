import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@shared/api/client';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('adminToken'));
  const isLoggedIn = computed(() => !!token.value);

  async function login(username: string, password: string) {
    const data = await api<{ token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    token.value = data.token;
    localStorage.setItem('adminToken', data.token);
  }

  function logout() {
    token.value = null;
    localStorage.removeItem('adminToken');
  }

  return { token, isLoggedIn, login, logout };
});
