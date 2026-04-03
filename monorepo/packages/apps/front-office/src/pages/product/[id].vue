<template>
  <div class="product-page">
    <h2>Product: {{ id }}</h2>
    <p>This page hosts the product fragment below.</p>
    <Fragment id="product" :fragment-props="{ id }" />
  </div>
</template>

<script setup lang="ts">
import { Fragment } from 'framework';

const { id } = defineProps<{ id: string }>();
</script>

<style scoped>
.product-page {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
}
</style>
