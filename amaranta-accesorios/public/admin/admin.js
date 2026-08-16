document.addEventListener('DOMContentLoaded', () => {
  const state = {
    session: null,
    products: [],
    categories: [],
    orders: [],
    customers: [],
    editingProductId: null,
  };

  const currency = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });

  const $ = (id) => document.getElementById(id);

  const productModal = new bootstrap.Modal($('productModal'));
  const orderModal = new bootstrap.Modal($('orderModal'));
  const categoryModal = new bootstrap.Modal($('categoryModal'));

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const data = await response.json();
    if (!response.ok && !data.success) {
      throw new Error(data.message || 'Solicitud fallida');
    }

    return data;
  }

  async function uploadProductImage(file) {
    if (!file) return '';

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'No se pudo subir la imagen');
    }

    return data.data.image_url;
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function statusBadge(status) {
    const labels = {
      pendiente: 'Pendiente',
      confirmado: 'Confirmado',
      completado: 'Completado',
      cancelado: 'Cancelado',
    };

    return `<span class="status-badge status-${status}">${labels[status] || status}</span>`;
  }

  function stockLabel(stock) {
    if (stock <= 0) return '<span class="stock-pill agotado">Agotado</span>';
    if (stock <= 3) return '<span class="stock-pill stock_bajo">Stock bajo</span>';
    return '<span class="stock-pill disponible">Disponible</span>';
  }

  function renderCategoryOptions() {
    const options = state.categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('');
    $('productCategorySelect').innerHTML = `<option value="">Seleccionar categoría</option>${options}`;
  }

  function renderProducts() {
    const search = $('productSearch').value.trim().toLowerCase();
    const rows = state.products.filter((product) => {
      if (!search) return true;
      return [product.name, product.description, product.category_name].join(' ').toLowerCase().includes(search);
    }).map((product) => `
      <tr>
        <td>
          <div class="fw-semibold">${product.name}</div>
          <div class="small text-body-secondary">${product.description || ''}</div>
        </td>
        <td>${product.category_name || 'Sin categoría'}</td>
        <td>${currency.format(Number(product.price))}</td>
        <td>${product.stock_quantity}</td>
        <td>${stockLabel(product.stock_quantity)} ${product.is_active ? '<span class="badge text-bg-success ms-1">Activo</span>' : '<span class="badge text-bg-secondary ms-1">Inactivo</span>'}</td>
        <td>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-sm btn-outline-primary" data-action="edit-product" data-id="${product.id}">Editar</button>
            <button class="btn btn-sm btn-outline-warning" data-action="toggle-product" data-id="${product.id}">${product.is_active ? 'Ocultar' : 'Mostrar'}</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-product" data-id="${product.id}">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');

    $('productsTable').innerHTML = rows || '<tr><td colspan="6" class="text-center text-body-secondary py-4">No hay productos</td></tr>';
  }

  function renderCategories() {
    $('categoriesTable').innerHTML = state.categories.map((category) => `
      <tr>
        <td class="fw-semibold">${category.name}</td>
        <td>${category.description || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-category" data-id="${category.id}">Eliminar</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="3" class="text-center text-body-secondary py-4">No hay categorías</td></tr>';
  }

  function renderOrders() {
    $('ordersTable').innerHTML = state.orders.map((order) => `
      <tr>
        <td>#${order.id}</td>
        <td>${order.customer_name}</td>
        <td>${order.customer_phone || '-'}</td>
        <td>${currency.format(Number(order.total_amount))}</td>
        <td>${statusBadge(order.status)}</td>
        <td>${formatDate(order.created_at)}</td>
        <td>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-sm btn-outline-primary" data-action="view-order" data-id="${order.id}">Ver</button>
            <select class="form-select form-select-sm" data-action="order-status" data-id="${order.id}" style="width:auto;min-width:140px;">
              <option value="pendiente" ${order.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="confirmado" ${order.status === 'confirmado' ? 'selected' : ''}>Confirmado</option>
              <option value="completado" ${order.status === 'completado' ? 'selected' : ''}>Completado</option>
              <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="text-center text-body-secondary py-4">No hay pedidos</td></tr>';
  }

  function renderCustomers() {
    $('customersTable').innerHTML = state.customers.map((customer) => `
      <tr>
        <td class="fw-semibold">${customer.name}</td>
        <td>${customer.phone || '-'}</td>
        <td>${customer.email || '-'}</td>
        <td>${customer.address || '-'}</td>
        <td>${customer.orders_count}</td>
        <td>${currency.format(Number(customer.total_spent))}</td>
        <td>${formatDate(customer.last_order_at)}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-customer" data-name="${customer.name}" data-phone="${customer.phone || ''}" data-email="${customer.email || ''}" data-address="${customer.address || ''}">Eliminar</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8" class="text-center text-body-secondary py-4">No hay clientes</td></tr>';
  }

  function updateStats(stats) {
    $('productsTotal').textContent = stats.products_total ?? 0;
    $('productsActive').textContent = stats.products_active ?? 0;
    $('ordersPending').textContent = stats.orders_pending ?? 0;
    $('totalRevenue').textContent = currency.format(Number(stats.total_revenue || 0));
  }

  function fillProductForm(product = null) {
    const form = $('productForm');
    form.reset();
    state.editingProductId = product?.id || null;
    $('productModalTitle').textContent = product ? 'Editar producto' : 'Crear producto';
    form.elements.id.value = product?.id || '';
    form.elements.name.value = product?.name || '';
    form.elements.description.value = product?.description || '';
    form.elements.price.value = product?.price || '';
    form.elements.stock_quantity.value = product?.stock_quantity || 0;
    form.elements.image_url.value = product?.image_url || '';
    form.elements.category_id.value = product?.category_id || '';
    form.elements.is_active.checked = product ? Boolean(product.is_active) : true;
  }

  async function loadSession() {
    const session = await api('/api/session');
    state.session = session.data;
    $('currentUsernameField').value = session.data?.username || 'admin';
  }

  async function loadStats() {
    const response = await api('/api/dashboard');
    updateStats(response.data);
  }

  async function loadCategories() {
    const response = await api('/api/categories');
    state.categories = response.data || [];
    renderCategoryOptions();
    renderCategories();
  }

  async function loadProducts() {
    const response = await api('/api/products?include_inactive=true');
    state.products = response.data || [];
    renderProducts();
  }

  async function loadOrders() {
    const response = await api('/api/orders');
    state.orders = response.data || [];
    renderOrders();
  }

  async function loadCustomers() {
    const response = await api('/api/customers');
    state.customers = response.data || [];
    renderCustomers();
  }

  async function refreshAll() {
    await Promise.all([loadStats(), loadCategories(), loadProducts(), loadOrders(), loadCustomers()]);
  }

  $('logoutBtn').addEventListener('click', async () => {
    await api('/api/logout');
    window.location.href = '/admin/login.html';
  });

  $('refreshProducts').addEventListener('click', loadProducts);
  $('productSearch').addEventListener('input', renderProducts);

  $('productForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    payload.price = Number(payload.price);
    payload.stock_quantity = Number(payload.stock_quantity);
    payload.is_active = $('productIsActive').checked;

    const imageFile = event.target.elements.image_file.files[0];
    if (imageFile) {
      payload.image_url = await uploadProductImage(imageFile);
    }
    delete payload.image_file;

    if (state.editingProductId) {
      await api(`/api/products/${state.editingProductId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    productModal.hide();
    fillProductForm();
    await refreshAll();
  });

  $('categoryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    await api('/api/categories', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    event.target.reset();
    await refreshAll();
  });

  $('categoryQuickForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    await api('/api/categories', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    event.target.reset();
    categoryModal.hide();
    await refreshAll();
  });

  $('changeUsernameForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    await api('/api/admin/account', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: payload.current_password,
        new_username: payload.new_username,
      }),
    });
    event.target.reset();
    await loadSession();
    alert('Usuario actualizado correctamente');
  });

  $('changePasswordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    await api('/api/admin/account', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: payload.current_password,
        new_password: payload.new_password,
        confirm_password: payload.confirm_password,
      }),
    });
    event.target.reset();
    alert('Contraseña actualizada correctamente');
  });

  $('productsTable').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = button.dataset.id;

    if (button.dataset.action === 'edit-product') {
      const product = state.products.find((item) => String(item.id) === String(id));
      if (!product) return;
      fillProductForm(product);
      productModal.show();
      return;
    }

    if (button.dataset.action === 'toggle-product') {
      const product = state.products.find((item) => String(item.id) === String(id));
      if (!product) return;
      await api(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          price: product.price,
          stock_quantity: product.stock_quantity,
          image_url: product.image_url,
          category_id: product.category_id,
          is_active: !product.is_active,
        }),
      });
      await refreshAll();
      return;
    }

    if (button.dataset.action === 'delete-product') {
      if (!confirm('¿Eliminar este producto?')) return;
      await api(`/api/products/${id}`, { method: 'DELETE' });
      await refreshAll();
    }
  });

  $('categoriesTable').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action="delete-category"]');
    if (!button) return;
    if (!confirm('¿Eliminar esta categoría?')) return;
    await api(`/api/categories/${button.dataset.id}`, { method: 'DELETE' });
    await refreshAll();
  });

  $('ordersTable').addEventListener('change', async (event) => {
    const select = event.target.closest('select[data-action="order-status"]');
    if (!select) return;
    await api(`/api/orders/${select.dataset.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: select.value }),
    });
    await loadOrders();
  });

  $('ordersTable').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action="view-order"]');
    if (!button) return;
    const response = await api(`/api/orders/${button.dataset.id}`);
    const order = response.data;
    $('orderDetailBody').innerHTML = `
      <div class="row g-3 mb-3">
        <div class="col-md-4"><strong>Cliente:</strong> ${order.customer_name}</div>
        <div class="col-md-4"><strong>Teléfono:</strong> ${order.customer_phone || '-'}</div>
        <div class="col-md-4"><strong>Estado:</strong> ${statusBadge(order.status)}</div>
        <div class="col-md-4"><strong>Correo:</strong> ${order.customer_email || '-'}</div>
        <div class="col-md-8"><strong>Dirección:</strong> ${order.customer_address || '-'}</div>
        <div class="col-12"><strong>Notas:</strong> ${order.notes || '-'}</div>
      </div>
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th><th>Notas</th></tr></thead>
          <tbody>
            ${order.items.map((item) => `
              <tr>
                <td>${item.product_name || 'Producto eliminado'}</td>
                <td>${item.quantity}</td>
                <td>${currency.format(Number(item.unit_price))}</td>
                <td>${currency.format(Number(item.subtotal))}</td>
                <td>${item.item_notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    orderModal.show();
  });

  $('customersTable').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action="delete-customer"]');
    if (!button) return;

    const { name, phone, email, address } = button.dataset;
    if (!confirm(`¿Eliminar el cliente ${name}? Se borrarán sus pedidos asociados.`)) return;

    const params = new URLSearchParams();
    if (phone) params.set('phone', phone);
    if (email) params.set('email', email);
    if (address) params.set('address', address);

    await api(`/api/customers/${encodeURIComponent(name)}?${params.toString()}`, {
      method: 'DELETE',
    });

    await refreshAll();
  });

  function updateClock() {
    $('adminDatetime').textContent = new Date().toLocaleString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  $('productForm').addEventListener('reset', () => {
    state.editingProductId = null;
    $('productModalTitle').textContent = 'Crear producto';
  });

  (async () => {
    try {
      await loadSession();
      updateClock();
      setInterval(updateClock, 60000);
      await refreshAll();
    } catch (error) {
      window.location.href = '/admin/login.html';
    }
  })();
});
