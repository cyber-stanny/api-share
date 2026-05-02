<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{
  visible: boolean;
  initialMode?: 'login' | 'register';
}>();

const emit = defineEmits<{
  close: [];
  success: [apiKey?: string];
}>();

const auth = useAuthStore();

const mode = ref<'login' | 'register' | 'reset'>(props.initialMode || 'login');
const studentId = ref('');
const password = ref('');
const name = ref('');
const error = ref('');
const message = ref('');
const loading = ref(false);

function switchMode(newMode: 'login' | 'register' | 'reset') {
  mode.value = newMode;
  error.value = '';
  message.value = '';
}

watch(() => props.initialMode, (value) => {
  mode.value = value || 'login';
  error.value = '';
  message.value = '';
});

watch(() => props.visible, (value) => {
  if (value) {
    mode.value = props.initialMode || 'login';
    error.value = '';
    message.value = '';
  }
});

async function handleSubmit() {
  error.value = '';
  message.value = '';
  loading.value = true;
  try {
    if (mode.value === 'register') {
      const apiKey = await auth.register(studentId.value, password.value, name.value);
      emit('success', apiKey);
      emit('close');
    } else if (mode.value === 'reset') {
      await auth.resetPassword(studentId.value, name.value, password.value);
      mode.value = 'login';
      password.value = '';
      message.value = '密码已重置，请使用新密码登录。';
    } else {
      await auth.login(studentId.value, password.value);
      emit('success');
      emit('close');
    }
  } catch (e: any) {
    error.value = e.message || '操作失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
      <div class="panel auth-panel">
        <button class="close-btn" @click="emit('close')">✕</button>
        <h2 class="panel-title">
          {{ mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码' }}
        </h2>
        <p class="panel-sub">
          {{
            mode === 'login'
              ? '输入学号和密码进入学生控制台。'
              : mode === 'register'
                ? '使用白名单学号注册，领取专属 API Key。'
                : '使用学号和姓名验证后设置新密码。'
          }}
        </p>
        <div v-if="mode !== 'reset'" class="tabs">
          <button
            class="tab"
            :class="{ active: mode === 'login' }"
            @click="switchMode('login')"
          >
            登录
          </button>
          <button
            class="tab"
            :class="{ active: mode === 'register' }"
            @click="switchMode('register')"
          >
            注册
          </button>
        </div>
        <div v-if="message" class="message ok">{{ message }}</div>
        <div v-if="error" class="message err">{{ error }}</div>
        <div class="field">
          <label>学号</label>
          <input v-model="studentId" class="input" placeholder="2024010001" />
        </div>
        <div v-if="mode === 'register' || mode === 'reset'" class="field">
          <label>姓名</label>
          <input v-model="name" class="input" placeholder="张同学" />
        </div>
        <div class="field">
          <label>{{ mode === 'reset' ? '新密码' : '密码' }}</label>
          <input v-model="password" type="password" class="input" placeholder="至少 6 位" />
        </div>
        <div class="form-actions">
          <button class="btn primary" :disabled="loading" @click="handleSubmit">
            {{
              mode === 'login'
                ? '登录'
                : mode === 'register'
                  ? '注册并领取 Key'
                  : '重置密码'
            }}
          </button>
          <button
            v-if="mode === 'login'"
            type="button"
            class="link-btn"
            @click="switchMode('reset')"
          >
            忘记密码
          </button>
          <span v-else-if="mode === 'register'" style="font-size:11px;color:var(--light-muted)">仅白名单学号可注册</span>
          <button
            v-else
            type="button"
            class="link-btn"
            @click="switchMode('login')"
          >
            返回登录
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
/* Teleported overlay — must be global since scoped styles don't follow Teleport */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(45,40,36,.45);
  backdrop-filter: blur(4px);
  z-index: 40;
}
</style>

<style scoped>
.auth-panel {
  width: min(480px, 100%);
  padding: 32px;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 12px 36px rgba(45,45,45,.12);
}
.panel-title {
  font: 700 24px var(--serif);
  margin: 0 0 5px;
}
.panel-sub { margin: 0 0 18px; color: var(--muted); font-size: 13px; line-height: 1.6; }
.tabs { display: flex; gap: 22px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.tab {
  border: 0; background: transparent; padding: 10px 0;
  color: var(--muted); border-bottom: 2px solid transparent;
  font-weight: 600; cursor: pointer;
}
.tab.active { color: var(--primary); border-color: var(--primary); }
.close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  border: 0;
  background: transparent;
  color: var(--light-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 6px;
  line-height: 1;
  border-radius: 4px;
}
.close-btn:hover { color: var(--muted); background: var(--bg); }
.auth-panel { position: relative; }
.form-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 20px; }
.link-btn {
  border: 0;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  padding: 0;
  font-size: 12px;
}
.link-btn:hover { color: var(--secondary); }
.message.ok {
  background: rgba(105, 141, 105, .12);
  color: var(--secondary);
}
</style>
