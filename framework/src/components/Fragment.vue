<script setup lang="ts">
defineProps<{ id: string; fragmentProps?: Record<string, string> }>()
</script>
<template>
  <div :data-fragment="id" :data-props="JSON.stringify(fragmentProps || {})" data-allow-mismatch />
</template>
