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
          <div class="form-group">
            <label>每日 token 上限</label>
            <input v-model.number="daily" type="number" />
          </div>
          <div class="form-group">
            <label>每周 token 上限</label>
            <input v-model.number="weekly" type="number" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="emit('close')">取消</button>
          <button class="btn btn-primary" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  min-width: 400px;
}
.modal h3 { margin-bottom: 16px; }
.form-row { display: flex; gap: 16px; margin-bottom: 16px; }
.form-group { flex: 1; }
.form-group label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
.form-group input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
.btn-primary { background: #4f46e5; color: #fff; }
</style>
