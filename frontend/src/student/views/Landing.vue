<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthModal from '../components/AuthModal.vue';
import KeyModal from '../components/KeyModal.vue';
import ModelGroupList from '../components/ModelGroupList.vue';
import { groupModelsByProvider } from '@shared/format';
import type { ModelInfo } from '@shared/api/types';

const router = useRouter();

const showAuthModal = ref(false);
const showKeyModal = ref(false);
const authMode = ref<'login' | 'register'>('login');
const registeredApiKey = ref('');

const publicModelCards: ModelInfo[] = [
  { id: 'MiniMax-M2.7', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.7-highspeed', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.5', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.5-highspeed', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.1', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.1-highspeed', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2.5-pro', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2.5', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2-pro', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2-omni', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
];

const publicGroups = groupModelsByProvider(publicModelCards);

function openAuth(mode: 'login' | 'register') {
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
    <section class="landing">
      <div class="hero">
        <div class="eyebrow">Token Plan Gateway · MiMo / MiniMax</div>
        <h1>学生专属的大模型 API 入口</h1>
        <p>用白名单学号注册，领取专属 API Key。当前开放 MiMo / MiniMax 文本模型，直接接入 Claude Code 或 OpenAI 兼容客户端。</p>
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
.layout { min-height: calc(100vh - 64px); }
.landing {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(320px, 460px);
  gap: 44px;
  padding: 62px 52px 44px;
  max-width: 1180px;
  margin: 0 auto;
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
  .landing { grid-template-columns: 1fr; padding: 34px 18px; }
  .models-strip { padding: 0 18px 32px; }
}
</style>
