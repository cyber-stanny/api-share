<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const username = ref('admin');
const password = ref('');
const error = ref('');

async function handleLogin() {
  error.value = '';
  try {
    await auth.login(username.value, password.value);
    router.push('/students');
  } catch (e: any) {
    error.value = e.message || '登录失败';
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-panel">
      <div class="login-brand">
        <div class="brand-mark">A</div>
        <div class="brand-name">API Share</div>
      </div>
      <h2 class="panel-title">管理后台</h2>
      <p class="panel-sub">输入管理员账号和密码登录。</p>
      <div v-if="error" class="message err">{{ error }}</div>
      <div class="field">
        <label>用户名</label>
        <input v-model="username" class="input" placeholder="admin" @keyup.enter="handleLogin" />
      </div>
      <div class="field">
        <label>密码</label>
        <input v-model="password" type="password" class="input" placeholder="输入密码" @keyup.enter="handleLogin" />
      </div>
      <div class="form-actions">
        <button class="btn primary" @click="handleLogin">登录</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--shell);
}
.login-panel {
  width: min(400px, 100%);
  padding: 32px;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 12px 36px rgba(45,45,45,.06), 0 0 0 1px rgba(45,45,45,.03);
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--primary);
  color: white;
  display: grid;
  place-items: center;
  font: 700 14px var(--mono);
}
.brand-name {
  font: 700 16px var(--serif);
}
.panel-title {
  font: 700 24px var(--serif);
  margin: 0 0 5px;
}
.panel-sub {
  margin: 0 0 18px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.form-actions {
  display: flex;
  margin-top: 20px;
}
.form-actions .btn {
  flex: 1;
}
</style>
