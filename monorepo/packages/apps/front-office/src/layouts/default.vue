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

<style>
html {
  height: 100%;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  margin: 0;
}

main {
  flex: 1;
}
</style>
