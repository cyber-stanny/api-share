<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import AuthModal from '../components/AuthModal.vue';
import KeyModal from '../components/KeyModal.vue';
import ModelGroupList from '../components/ModelGroupList.vue';
import TopBar from '@shared/components/TopBar.vue';
import { groupModelsByProvider } from '@shared/format';
import type { ModelInfo } from '@shared/api/types';

const router = useRouter();
const auth = useAuthStore();


const showAuthModal = ref(false);
const showKeyModal = ref(false);
const authMode = ref<'login' | 'register'>('login');
const registeredApiKey = ref('');

const publicModelCards: ModelInfo[] = [
  { id: 'deepseek-v4-flash', provider: 'DeepSeek Official API', protocols: ['openai', 'anthropic'] },
  { id: 'deepseek-v4-pro', provider: 'DeepSeek Official API', protocols: ['openai', 'anthropic'] },
  { id: 'glm-5.2', provider: '智谱 GLM Official API', protocols: ['openai'] },
];

const publicGroups = groupModelsByProvider(publicModelCards);

function openAuth(mode: 'login' | 'register') {
  if (auth.isLoggedIn) {
    router.push('/overview');
    return;
  }
  authMode.value = mode;
  showAuthModal.value = true;
}

async function handleAuthSuccess(apiKey?: string) {
  if (apiKey) {
    registeredApiKey.value = apiKey;
    showKeyModal.value = true;
    return;
  }
  await router.push('/overview');
}
</script>

<template>
  <div class="layout">
    <TopBar />
    <section class="landing">
      <div class="hero">
        <div class="eyebrow">API Gateway · DeepSeek / GLM</div>
        <h1>学生专属的大模型 API 入口</h1>
        <p>用白名单学号注册，领取专属 API Key。当前开放 DeepSeek 与智谱 GLM 模型，可接入 Claude Code 或 OpenAI 兼容客户端。平台 API 将于 2026 年 8 月 31 日停止供应。</p>
        <div class="actions">
          <button class="btn primary" @click="openAuth('register')">注册领取 Key</button>
          <button class="btn" @click="openAuth('login')">登录控制台</button>
        </div>
      </div>
    </section>
    <section class="models-strip">
      <div class="section-label">开放模型</div>
      <ModelGroupList :groups="publicGroups" />
    </section>

    <AuthModal
      :visible="showAuthModal"
      :initial-mode="authMode"
      @close="showAuthModal = false"
      @success="handleAuthSuccess"
    />
    <KeyModal
      :visible="showKeyModal"
      :api-key="registeredApiKey"
      @close="showKeyModal = false"
    />
  </div>
</template>

<style scoped>
.layout { width: 100%; min-height: calc(100vh - 64px); display: flex; flex-direction: column; box-sizing: border-box; }
.landing {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 62px 52px 52px;
  max-width: 1180px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
.eyebrow {
  color: var(--secondary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .12em;
  text-transform: uppercase;
  margin-bottom: 18px;
}
.hero h1 {
  font: 700 48px/1.14 var(--serif);
  margin: 0 0 18px;
  letter-spacing: 0;
}
.hero p {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.9;
  max-width: 520px;
  margin: 0 0 28px;
}
.actions { display: flex; gap: 12px; flex-wrap: wrap; }
.models-strip {
  max-width: 1180px;
  margin: 0 auto 44px;
  padding: 0 52px;
  width: 100%;
  box-sizing: border-box;
}
.section-label {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  margin-bottom: 12px;
}
@media (max-width: 900px) {
  .landing { padding: 34px 18px; }
  .models-strip { padding: 0 18px 32px; }
}
</style>
