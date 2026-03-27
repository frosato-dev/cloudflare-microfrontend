<template>
  <div class="product-card">
    <div class="product-image">
      <div class="placeholder-img">{{ id }}</div>
    </div>
    <div class="product-info">
      <h3>{{ id }}</h3>
      <p class="condition">Excellent condition</p>
      <p class="price">From {{ price }}</p>
      <button @click="addToCart" class="add-btn">
        {{ added ? 'Added!' : 'Add to cart' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ id?: string }>();

const added = ref(false);

const price = computed(() => {
  // Mock pricing
  const prices: Record<string, string> = {
    'iphone-15': '$699',
    'iphone-14': '$549',
    'galaxy-s24': '$629',
  };
  return prices[props.id || ''] || '$499';
});

function addToCart() {
  added.value = true;
  // Pub-sub event for cross-fragment communication
  window.dispatchEvent(
    new CustomEvent('fragment:event', {
      detail: { type: 'cart:add', payload: { productId: props.id } },
    }),
  );
  setTimeout(() => (added.value = false), 2000);
}
</script>

<style scoped>
.product-card {
  max-width: 400px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  margin: 1rem 0;
}
.placeholder-img {
  background: #f5f5f5;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #999;
  text-transform: uppercase;
}
.product-info {
  padding: 1rem;
}
.condition {
  color: #00c853;
  font-size: 0.875rem;
  margin: 0.25rem 0;
}
.price {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0.5rem 0;
}
.add-btn {
  width: 100%;
  padding: 0.75rem;
  background: #00c853;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}
.add-btn:hover { background: #00b348; }
</style>
