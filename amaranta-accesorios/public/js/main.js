document.addEventListener('DOMContentLoaded', () => {
  const state = {
    products: [],
    categories: [],
    cart: JSON.parse(localStorage.getItem('amaranta_cart') || '[]'),
    selectedCategory: 'all',
    searchTerm: '',
    selectedProduct: null,
  };

  const currency = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });

  const elements = {
    grid: document.getElementById('productsGrid'),
    categories: document.getElementById('categoryFilters'),
    search: document.getElementById('searchInput'),
    resultsInfo: document.getElementById('resultsInfo'),
    cartCount: document.getElementById('cartCount'),
    cartCountTop: document.getElementById('cartCountTop'),
    cartItems: document.getElementById('cartItems'),
    cartEmpty: document.getElementById('cartEmpty'),
    cartItemsList: document.getElementById('cartItemsList'),
    cartSubtotal: document.getElementById('cartSubtotal'),
    cartTotal: document.getElementById('cartTotal'),
    checkoutBtn: document.getElementById('checkoutBtn'),
    checkoutForm: document.getElementById('checkoutForm'),
    checkoutTotal: document.getElementById('checkoutTotal'),
    currentDatetime: document.getElementById('current-datetime'),
    productModalBody: document.getElementById('productModalBody'),
    productModalTitle: document.getElementById('productModalTitle'),
    openCartTop: document.getElementById('openCartTop'),
    orderStatusForm: document.getElementById('orderStatusForm'),
    orderStatusResult: document.getElementById('orderStatusResult'),
  };

  const productModal = new bootstrap.Modal(document.getElementById('productModal'));
  const checkoutModal = new bootstrap.Modal(document.getElementById('checkoutModal'));
  const toastContainer = document.getElementById('toastContainer');

  function whatsappUrl(text) {
    return `/whatsapp?text=${encodeURIComponent(text)}`;
  }

  function showNotification(message, variant = 'success') {
    if (!toastContainer || !window.bootstrap?.Toast) {
      alert(message);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-bg-${variant} border-0`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
      </div>
    `;

    toastContainer.appendChild(toast);
    const toastInstance = new bootstrap.Toast(toast, { delay: 2200 });
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
    toastInstance.show();
  }

  function persistCart() {
    localStorage.setItem('amaranta_cart', JSON.stringify(state.cart));
  }

  function formatDateTime() {
    elements.currentDatetime.textContent = new Date().toLocaleString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStockStatus(product) {
    if (product.stock_quantity <= 0) return 'agotado';
    if (product.stock_quantity <= 3) return 'stock_bajo';
    return 'disponible';
  }

  function getFilteredProducts() {
    return state.products.filter((product) => {
      const matchesCategory = state.selectedCategory === 'all' || String(product.category_id) === String(state.selectedCategory);
      const haystack = `${product.name} ${product.description || ''} ${product.category_name || ''}`.toLowerCase();
      const matchesSearch = !state.searchTerm || haystack.includes(state.searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }

  function updateCartSummary() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.cart.reduce((sum, item) => sum + item.quantity * Number(item.price), 0);

    elements.cartCount.textContent = count;
    elements.cartCountTop.textContent = count;
    elements.cartSubtotal.textContent = currency.format(subtotal);
    elements.cartTotal.textContent = currency.format(subtotal);
    elements.checkoutTotal.textContent = currency.format(subtotal);
    elements.checkoutBtn.disabled = state.cart.length === 0;

    if (state.cart.length === 0) {
      elements.cartEmpty.classList.remove('d-none');
      elements.cartItems.classList.add('d-none');
      return;
    }

    elements.cartEmpty.classList.add('d-none');
    elements.cartItems.classList.remove('d-none');

    elements.cartItemsList.innerHTML = state.cart.map((item, index) => `
      <div class="list-group-item cart-item p-3">
        <div class="d-flex gap-3 align-items-start">
          <img class="thumb" src="${item.image_url || 'https://placehold.co/120x120'}" alt="${item.name}">
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between gap-2">
              <div>
                <div class="fw-semibold">${item.name}</div>
                <div class="small text-body-secondary">${currency.format(Number(item.price))}</div>
              </div>
              <button class="btn btn-sm btn-light border" data-action="remove-item" data-index="${index}"><i class="bi bi-trash"></i></button>
            </div>
            <div class="d-flex align-items-center gap-2 mt-3 flex-wrap">
              <button class="btn btn-sm btn-outline-secondary" data-action="decrease-item" data-index="${index}">-</button>
              <input class="form-control form-control-sm" style="width:86px;" type="number" min="1" max="${item.stock_quantity}" data-action="quantity-item" data-index="${index}" value="${item.quantity}">
              <button class="btn btn-sm btn-outline-secondary" data-action="increase-item" data-index="${index}">+</button>
              <input class="form-control form-control-sm ms-auto" style="max-width:180px;" placeholder="Notas" data-action="note-item" data-index="${index}" value="${item.notes || ''}">
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderOrderStatusResult(order) {
    const statusLabels = {
      pendiente: 'Pendiente',
      confirmado: 'Confirmado',
      completado: 'Completado',
      cancelado: 'Cancelado',
    };

    const messageMap = {
      pendiente: 'Tu pedido está en revisión.',
      confirmado: 'Tu pedido fue confirmado.',
      completado: 'Tu pedido ya fue completado.',
      cancelado: 'Tu pedido fue cancelado.',
    };

    const whatsappMessage = `Hola Amaranta Accesorios, quiero consultar sobre mi pedido #${order.id}.`;

    elements.orderStatusResult.classList.remove('d-none');
    elements.orderStatusResult.innerHTML = `
      <div class="alert alert-light border shadow-soft mb-0">
        <div class="d-flex flex-column flex-md-row justify-content-between gap-3 align-items-md-center">
          <div>
            <div class="small text-body-secondary">Pedido #${order.id}</div>
            <div class="h5 mb-1">${statusLabels[order.status] || order.status}</div>
            <p class="mb-0">${messageMap[order.status] || 'Estado consultado correctamente.'}</p>
          </div>
          <div class="d-flex flex-column gap-2">
            <a class="btn btn-outline-amaranta" href="${whatsappUrl(whatsappMessage)}" target="_blank" rel="noreferrer">
              <i class="bi bi-whatsapp me-1"></i>WhatsApp del administrador
            </a>
            <div class="small text-body-secondary">${order.customer_name} · ${order.customer_phone}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderProducts() {
    const products = getFilteredProducts();
    elements.resultsInfo.textContent = `${products.length} producto(s) encontrados`;

    elements.grid.innerHTML = products.map((product) => {
      const stockStatus = getStockStatus(product);
      const stockText = stockStatus === 'agotado' ? 'Agotado' : stockStatus === 'stock_bajo' ? 'Stock bajo' : 'Disponible';
      const disabled = product.stock_quantity <= 0 ? 'disabled' : '';

      return `
        <div class="col-12 col-sm-6 col-xl-4">
          <article class="product-card h-100">
            <img class="product-image" src="${product.image_url || '/images/placeholder.svg'}" alt="${product.name}" onerror="this.onerror=null;this.src='/images/placeholder.svg';">
            <div class="product-body d-flex flex-column gap-2">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <h3 class="h5 mb-1">${product.name}</h3>
                  <div class="small text-body-secondary">${product.category_name || 'Sin categoría'}</div>
                </div>
                <span class="stock-pill ${stockStatus}">${stockText}</span>
              </div>
              <p class="text-body-secondary small mb-0 flex-grow-1">${product.description || 'Sin descripción disponible'}</p>
              <div class="d-flex justify-content-between align-items-center pt-2">
                <div class="product-price">${currency.format(Number(product.price))}</div>
                <div class="small text-body-secondary">Stock: ${product.stock_quantity}</div>
              </div>
              <div class="d-grid gap-2 d-md-flex">
                <button class="btn btn-outline-amaranta flex-grow-1" data-action="view-product" data-id="${product.id}">Detalles</button>
                <button class="btn btn-amaranta flex-grow-1" data-action="add-cart" data-id="${product.id}" ${disabled}>Agregar</button>
              </div>
            </div>
          </article>
        </div>
      `;
    }).join('');

    if (!products.length) {
      elements.grid.innerHTML = '<div class="col-12"><div class="alert alert-light border shadow-soft">No se encontraron productos con esos filtros.</div></div>';
    }
  }

  function renderCategories() {
    const buttons = [`<button class="btn active" data-category="all">Todos</button>`].concat(
      state.categories.map((category) => `<button class="btn" data-category="${category.id}">${category.name}</button>`)
    );
    elements.categories.innerHTML = buttons.join('');
  }

  function addToCart(product, quantity = 1, notes = '') {
    if (product.stock_quantity <= 0) return;

    const existing = state.cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, product.stock_quantity);
      existing.notes = notes || existing.notes || '';
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        quantity,
        stock_quantity: product.stock_quantity,
        image_url: product.image_url,
        notes,
      });
    }

    persistCart();
    updateCartSummary();
    showNotification(`${product.name} agregado al carrito`);
  }

  async function fetchProducts() {
    const params = new URLSearchParams();
    if (state.selectedCategory !== 'all') params.set('category', state.selectedCategory);
    if (state.searchTerm) params.set('search', state.searchTerm);
    const response = await fetch(`/api/products?${params.toString()}`);
    const data = await response.json();
    state.products = data.data || [];
    renderProducts();
  }

  async function fetchCategories() {
    const response = await fetch('/api/categories');
    const data = await response.json();
    state.categories = data.data || [];
    renderCategories();
  }

  async function showProductModal(productId) {
    const response = await fetch(`/api/products/${productId}`);
    const data = await response.json();
    if (!data.success) return;

    const product = data.data;
    state.selectedProduct = product;
    elements.productModalTitle.textContent = product.name;
    elements.productModalBody.innerHTML = `
      <div class="row g-4">
        <div class="col-md-5">
          <img class="img-fluid rounded-4 shadow-soft w-100" src="${product.image_url || '/images/placeholder.svg'}" alt="${product.name}" onerror="this.onerror=null;this.src='/images/placeholder.svg';">
        </div>
        <div class="col-md-7">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
            <div>
              <div class="text-body-secondary small mb-1">${product.category_name || 'Sin categoría'}</div>
              <h3 class="h3 mb-0">${product.name}</h3>
            </div>
            <span class="stock-pill ${getStockStatus(product)}">${product.stock_quantity <= 0 ? 'Agotado' : product.stock_quantity <= 3 ? 'Stock bajo' : 'Disponible'}</span>
          </div>
          <div class="product-price mb-2">${currency.format(Number(product.price))}</div>
          <p class="text-body-secondary">${product.description || ''}</p>
          <div class="mb-3">Stock disponible: <strong>${product.stock_quantity}</strong></div>
          <div class="row g-2 align-items-end">
            <div class="col-4">
              <label class="form-label">Cantidad</label>
              <input type="number" class="form-control" id="detailQuantity" min="1" max="${product.stock_quantity}" value="1">
            </div>
            <div class="col-8">
              <label class="form-label">Notas</label>
              <input type="text" class="form-control" id="detailNotes" placeholder="Color, empaque, observaciones...">
            </div>
          </div>
        </div>
      </div>
    `;
    productModal.show();
  }

  function syncCartFromInputs(container) {
    const quantityInput = container.querySelector('[data-action="quantity-item"]');
    const noteInput = container.querySelector('[data-action="note-item"]');
    return { quantityInput, noteInput };
  }

  elements.grid.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const productId = button.dataset.id;
    const product = state.products.find((item) => String(item.id) === String(productId));
    if (!product) return;

    if (button.dataset.action === 'view-product') {
      await showProductModal(productId);
      return;
    }

    if (button.dataset.action === 'add-cart') {
      addToCart(product, 1);
      return;
    }
  });

  elements.categories.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;

    state.selectedCategory = button.dataset.category;
    elements.categories.querySelectorAll('button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    await fetchProducts();
  });

  elements.search.addEventListener('input', async () => {
    state.searchTerm = elements.search.value.trim();
    await fetchProducts();
  });

  document.getElementById('productModal').addEventListener('click', (event) => {
    if (!state.selectedProduct) return;
    if (event.target.closest('#addToCartFromModal')) {
      const quantity = Number(document.getElementById('detailQuantity').value || 1);
      const notes = document.getElementById('detailNotes').value.trim();
      if (quantity < 1 || quantity > state.selectedProduct.stock_quantity) {
        alert('Cantidad inválida');
        return;
      }
      addToCart(state.selectedProduct, quantity, notes);
      productModal.hide();
    }
  });

  document.getElementById('productModal').addEventListener('shown.bs.modal', () => {
    const body = elements.productModalBody;
    if (!body.querySelector('#addToCartFromModal')) {
      body.insertAdjacentHTML('beforeend', '<div class="d-grid mt-4"><button class="btn btn-amaranta btn-lg" id="addToCartFromModal">Agregar al carrito</button></div>');
    }
  });

  elements.cartItemsList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const index = Number(button.dataset.index);
    const item = state.cart[index];
    if (!item) return;

    if (button.dataset.action === 'remove-item') {
      state.cart.splice(index, 1);
    }

    if (button.dataset.action === 'increase-item') {
      item.quantity = Math.min(item.quantity + 1, item.stock_quantity);
    }

    if (button.dataset.action === 'decrease-item') {
      item.quantity = Math.max(item.quantity - 1, 1);
    }

    persistCart();
    updateCartSummary();
  });

  elements.cartItemsList.addEventListener('input', (event) => {
    const input = event.target.closest('[data-action]');
    if (!input) return;

    const index = Number(input.dataset.index);
    const item = state.cart[index];
    if (!item) return;

    if (input.dataset.action === 'quantity-item') {
      const value = Number(input.value);
      item.quantity = Math.min(Math.max(value, 1), item.stock_quantity);
    }

    if (input.dataset.action === 'note-item') {
      item.notes = input.value;
    }

    persistCart();
    updateCartSummary();
  });

  elements.checkoutBtn.addEventListener('click', () => {
    elements.checkoutTotal.textContent = currency.format(state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
  });

  elements.checkoutForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!state.cart.length) {
      alert('El carrito está vacío');
      return;
    }

    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        items: state.cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          item_notes: item.notes || '',
        })),
      }),
    });

    const data = await response.json();
    if (!data.success) {
      alert(data.message || 'No se pudo crear el pedido');
      return;
    }

    const whatsappMessage = `Hola Amaranta Accesorios, quiero consultar sobre mi pedido #${data.data.order_id}.`;
    state.cart = [];
    persistCart();
    updateCartSummary();
    event.target.reset();
    checkoutModal.hide();
    alert(`Pedido reservado correctamente. Número de pedido: ${data.data.order_id}`);
    window.open(whatsappUrl(whatsappMessage), '_blank', 'noopener,noreferrer');
  });

  elements.orderStatusForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const customerName = formData.get('name');
    const phone = formData.get('phone');

    try {
      const response = await fetch(`/api/orders/public?name=${encodeURIComponent(customerName)}&phone=${encodeURIComponent(phone)}`);
      const data = await response.json();

      if (!data.success) {
        elements.orderStatusResult.classList.remove('d-none');
        elements.orderStatusResult.innerHTML = `<div class="alert alert-warning mb-0">${data.message || 'Pedido no encontrado'}</div>`;
        return;
      }

      renderOrderStatusResult(data.data);
    } catch (error) {
      elements.orderStatusResult.classList.remove('d-none');
      elements.orderStatusResult.innerHTML = '<div class="alert alert-danger mb-0">No se pudo consultar el pedido.</div>';
    }
  });

  elements.openCartTop.addEventListener('click', () => {
    updateCartSummary();
    checkoutModal.show();
  });

  async function init() {
    formatDateTime();
    setInterval(formatDateTime, 60000);
    await Promise.all([fetchCategories(), fetchProducts()]);
    updateCartSummary();
  }

  init();
});
