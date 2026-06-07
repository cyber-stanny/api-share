<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Quota } from '@shared/api/types';

const props = defineProps<{
  visible: boolean;
  studentId: string;
  quota: Quota;
}>();

const emit = defineEmits<{
  close: [];
  save: [quota: Quota];
}>();

const form = ref<Quota>({ ...props.quota });

watch(() => props.visible, (v) => {
  if (v) {
    form.value = { ...props.quota };
  }
});

function handleSave() {
  emit('save', { ...form.value });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
      <div class="modal">
        <h3>调整额度 - {{ studentId }}</h3>
        <div class="section-label">MiMo token 限额</div>
        <div class="form-row">
          <div class="field">
            <label>每日 token 上限</label>
            <input v-model.number="form.mimoDailyTokenLimit" class="input" type="number" min="0" />
          </div>
          <div class="field">
            <label>每周 token 上限</label>
            <input v-model.number="form.mimoWeeklyTokenLimit" class="input" type="number" min="0" />
          </div>
        </div>

        <div class="section-label">Aliyun Token Plan 限额</div>
        <div class="form-row">
          <div class="field">
            <label>每日 token 上限</label>
            <input v-model.number="form.aliyunDailyTokenLimit" class="input" type="number" min="0" />
          </div>
          <div class="field">
            <label>每周 token 上限</label>
            <input v-model.number="form.aliyunWeeklyTokenLimit" class="input" type="number" min="0" />
          </div>
        </div>

        <div class="section-label">DeepSeek 金额限额</div>
        <div class="form-row">
          <div class="field">
            <label>每日金额上限（元）</label>
            <input v-model.number="form.deepseekDailyCostLimitCny" class="input" type="number" min="0" step="0.01" />
          </div>
          <div class="field">
            <label>每周金额上限（元）</label>
            <input v-model.number="form.deepseekWeeklyCostLimitCny" class="input" type="number" min="0" step="0.01" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="emit('close')">取消</button>
          <button class="btn primary" @click="handleSave">保存</button>
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
  background: rgba(45,40,36,.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
</style>

<style scoped>
.modal {
  background: var(--surface);
  border-radius: 12px;
  padding: 28px;
  min-width: 440px;
  max-width: min(560px, calc(100vw - 32px));
  box-shadow: 0 12px 36px rgba(45,45,45,.08);
}
.modal h3 { margin: 0 0 16px; font: 700 18px var(--serif); }
.section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--muted);
  margin: 14px 0 8px;
}
.section-label:first-of-type { margin-top: 0; }
.form-row { display: flex; gap: 16px; }
.field { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.field label { font-size: 12px; color: var(--muted); }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
</style>
