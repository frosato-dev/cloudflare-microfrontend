<template>
  <Fragment id="header" />
  <main>
    <slot />
  </main>
  <Fragment id="footer" />
</template>

<script setup lang="ts">
import { Fragment } from 'framework';
</script>
