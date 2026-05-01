<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  apiKey: string;
}>();

const emit = defineEmits<{
  close: [];
  copied: [];
}>();

async function copyKey() {
  try {
    await navigator.clipboard.writeText(props.apiKey);
    emit('copied');
  } catch {
    // fallback
    const el = document.createElement('textarea');
    el.value = props.apiKey;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal">
      <div class="panel modal-card">
        <h2 class="panel-title">保存你的 API Key</h2>
        <p class="panel-sub">完整 Key 只显示这一次。关闭后只能重新生成。</p>
        <div class="saved-key">{{ apiKey }}</div>
        <div class="form-actions">
          <button class="btn" @click="copyKey">复制 Key</button>
          <button class="btn primary" @click="emit('close')">我已保存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(45,45,45,.3);
  z-index: 40;
}
.modal-card { width: min(680px, 100%); padding: 24px; }
.panel { background: var(--surface); border-radius: 12px; }
.panel-title { font: 700 24px var(--serif); margin: 0 0 5px; }
.panel-sub { margin: 0 0 18px; color: var(--muted); font-size: 13px; line-height: 1.6; }
.saved-key {
  padding: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font: 12px/1.6 var(--mono);
  word-break: break-all;
}
.form-actions { display: flex; gap: 12px; margin-top: 20px; }
</style>
