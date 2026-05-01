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
    <div class="login-box">
      <h2>API Share 管理后台</h2>
      <div v-if="error" class="msg msg-err">{{ error }}</div>
      <input v-model="username" placeholder="用户名" @keyup.enter="handleLogin" />
      <input
        v-model="password"
        type="password"
        placeholder="密码"
        @keyup.enter="handleLogin"
      />
      <button class="btn btn-primary" @click="handleLogin">登录</button>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f7fa;
}
.login-box {
  width: 100%;
  max-width: 360px;
  padding: 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
}
.login-box h2 {
  text-align: center;
  margin-bottom: 24px;
  font-size: 20px;
}
.login-box input {
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}
.btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}
.btn-primary { background: #4f46e5; color: #fff; }
.msg {
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 14px;
}
.msg-err { background: #fee2e2; color: #991b1b; }
</style>
