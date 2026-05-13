<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  formatShanghaiRangeLabel,
  getShanghaiRecentDaysRange,
  getShanghaiTodayRange,
  getShanghaiWeekRange,
  getShanghaiYesterdayRange,
  parseShanghaiDateTimeValue,
  toShanghaiIso,
  type DateRangeValue,
} from '../timeRange';

const props = defineProps<{
  startDate?: string;
  endDate?: string;
}>();

const emit = defineEmits<{
  (event: 'update:startDate', value: string): void;
  (event: 'update:endDate', value: string): void;
  (event: 'apply'): void;
}>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const localStartDate = ref('');
const localStartTime = ref('00:00');
const localEndDate = ref('');
const localEndTime = ref('23:59');

const label = computed(() => formatShanghaiRangeLabel(props.startDate || '', props.endDate || ''));

function syncLocalValues() {
  const start = parseShanghaiDateTimeValue(props.startDate);
  const end = parseShanghaiDateTimeValue(props.endDate);
  localStartDate.value = start?.date || '';
  localStartTime.value = start?.time || '00:00';
  localEndDate.value = end?.date || '';
  localEndTime.value = end?.time || '23:59';
}

function commitRange(startDate: string, endDate: string) {
  emit('update:startDate', startDate);
  emit('update:endDate', endDate);
  emit('apply');
}

function applyManualRange() {
  commitRange(
    toShanghaiIso(localStartDate.value, localStartTime.value),
    toShanghaiIso(localEndDate.value, localEndTime.value, true),
  );
  open.value = false;
}

function applyPreset(range: DateRangeValue) {
  commitRange(range.startDate, range.endDate);
  open.value = false;
}

function clearRange() {
  localStartDate.value = '';
  localStartTime.value = '00:00';
  localEndDate.value = '';
  localEndTime.value = '23:59';
  commitRange('', '');
  open.value = false;
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!open.value || !root.value) return;
  if (!root.value.contains(event.target as Node)) open.value = false;
}

watch(() => [props.startDate, props.endDate], syncLocalValues, { immediate: true });

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
});
</script>

<template>
  <div ref="root" class="date-range-picker">
    <button class="range-trigger" type="button" @click="open = !open">
      <span>{{ label }}</span>
      <span class="caret">v</span>
    </button>
    <div v-if="open" class="range-panel">
      <div class="preset-row">
        <button type="button" @click="applyPreset(getShanghaiTodayRange())">今日</button>
        <button type="button" @click="applyPreset(getShanghaiYesterdayRange())">昨日</button>
        <button type="button" @click="applyPreset(getShanghaiRecentDaysRange(3))">近三天</button>
        <button type="button" @click="applyPreset(getShanghaiWeekRange())">本周</button>
      </div>
      <div class="field-grid">
        <label>
          <span>开始</span>
          <div class="input-pair">
            <input v-model="localStartDate" type="date" />
            <input v-model="localStartTime" type="time" />
          </div>
        </label>
        <label>
          <span>结束</span>
          <div class="input-pair">
            <input v-model="localEndDate" type="date" />
            <input v-model="localEndTime" type="time" />
          </div>
        </label>
      </div>
      <div class="range-actions">
        <button class="plain" type="button" @click="clearRange">清空</button>
        <button class="primary" type="button" @click="applyManualRange">应用</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.date-range-picker {
  position: relative;
  min-width: 270px;
}

.range-trigger {
  width: 100%;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.range-trigger:hover {
  border-color: var(--primary);
}

.caret {
  color: var(--muted);
  font: 700 11px var(--mono);
}

.range-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 20;
  width: 360px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 16px 38px rgba(45,45,45,.14);
}

.preset-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.preset-row button,
.range-actions button {
  border: 0;
  border-radius: 7px;
  padding: 8px 10px;
  font-weight: 600;
  cursor: pointer;
}

.preset-row button {
  background: var(--secondary-light);
  color: var(--secondary);
}

.field-grid {
  display: grid;
  gap: 10px;
}

.field-grid label span {
  display: block;
  margin-bottom: 5px;
  font-size: 11px;
  color: var(--muted);
}

.input-pair {
  display: grid;
  grid-template-columns: 1fr 110px;
  gap: 8px;
}

.input-pair input {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: #fff;
  padding: 8px 10px;
  font-size: 13px;
}

.range-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.range-actions .plain {
  background: var(--bg);
  color: var(--muted);
}

.range-actions .primary {
  background: var(--primary);
  color: #fff;
}

@media (max-width: 640px) {
  .date-range-picker {
    min-width: 0;
    width: 100%;
  }

  .range-panel {
    width: min(360px, calc(100vw - 48px));
  }

  .preset-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .input-pair {
    grid-template-columns: 1fr;
  }
}
</style>
