<template>
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-col">
        <a href="/" class="logo">Back Market</a>
        <p class="tagline">Refurbished tech.<br>Better for your wallet, better for the planet.</p>
      </div>
      <div class="footer-col">
        <h4>Shop</h4>
        <a href="/product/iphone-15">iPhone</a>
        <a href="/product/macbook-pro">MacBook</a>
        <a href="/product/galaxy-s24">Samsung</a>
        <a href="/product/ipad-air">iPad</a>
      </div>
      <div class="footer-col">
        <h4>About</h4>
        <a href="#">Our mission</a>
        <a href="#">Quality standards</a>
        <a href="#">Sustainability</a>
        <a href="#">Careers</a>
      </div>
      <div class="footer-col">
        <h4>Help</h4>
        <a href="#">FAQ</a>
        <a href="#">Returns</a>
        <a href="#">Warranty</a>
        <a href="#">Contact us</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 Back Market — All rights reserved</p>
    </div>
  </footer>
</template>

<script setup lang="ts">
</script>

<style scoped>
.footer {
  background: #1a1a2e;
  color: #ccc;
  padding: 3rem 1rem 1.5rem;
  margin-top: 4rem;
}
.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 2rem;
}
.footer-col {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.logo {
  font-weight: bold;
  font-size: 1.25rem;
  color: #00c853;
  text-decoration: none;
}
.tagline {
  font-size: 0.875rem;
  line-height: 1.5;
  color: #999;
}
h4 {
  color: white;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}
.footer-col a {
  color: #999;
  text-decoration: none;
  font-size: 0.875rem;
}
.footer-col a:hover {
  color: white;
}
.footer-bottom {
  max-width: 1200px;
  margin: 2rem auto 0;
  padding-top: 1.5rem;
  border-top: 1px solid #2a2a4e;
  font-size: 0.75rem;
  color: #666;
}
</style>
