<template>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">Back Market</a>
      <nav>
        <a href="/">Home</a>
        <a href="/product/iphone-15">Products</a>
      </nav>
      <button class="cart-btn" @click="cartCount++">
        Cart ({{ cartCount }})
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const cartCount = ref(0);
</script>

<style scoped>
.header {
  background: #1a1a2e;
  color: white;
  padding: 1rem;
}
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 2rem;
}
.logo {
  font-weight: bold;
  font-size: 1.25rem;
  color: #00c853;
  text-decoration: none;
}
nav a {
  color: #ccc;
  text-decoration: none;
  margin-right: 1rem;
}
nav a:hover { color: white; }
.cart-btn {
  margin-left: auto;
  background: #00c853;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}
</style>
