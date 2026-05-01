<script setup lang="ts">
defineProps<{
  message?: string;
}>();
</script>

<template>
  <div class="empty-state">
    <slot name="icon" />
    <p>{{ message || '暂无数据' }}</p>
  </div>
</template>

<style scoped>
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--muted);
}
.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}
</style>
