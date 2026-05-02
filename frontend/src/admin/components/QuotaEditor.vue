<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  studentId: string;
  currentDaily: number;
  currentWeekly: number;
}>();

const emit = defineEmits<{
  close: [];
  save: [daily: number, weekly: number];
}>();

const daily = ref(props.currentDaily);
const weekly = ref(props.currentWeekly);

watch(() => props.visible, (v) => {
  if (v) {
    daily.value = props.currentDaily;
    weekly.value = props.currentWeekly;
  }
});

function handleSave() {
  emit('save', daily.value, weekly.value);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
      <div class="modal">
        <h3>调整额度 - {{ studentId }}</h3>
        <div class="form-row">
          <div class="field">
            <label>每日 token 上限</label>
            <input v-model.number="daily" class="input" type="number" />
          </div>
          <div class="field">
            <label>每周 token 上限</label>
            <input v-model.number="weekly" class="input" type="number" />
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
  min-width: 400px;
  box-shadow: 0 12px 36px rgba(45,45,45,.08);
}
.modal h3 { margin: 0 0 16px; font: 700 18px var(--serif); }
.form-row { display: flex; gap: 16px; margin-bottom: 16px; }
.field { flex: 1; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>
