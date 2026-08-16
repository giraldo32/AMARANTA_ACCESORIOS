document.addEventListener('DOMContentLoaded', () => {
  const state = {
    session: null,
    products: [],
    categories: [],
    orders: [],
    customers: [],
    editingProductId: null
  };

  const currency = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  });

  const $ = (id) => document.getElementById(id);

  const productModal = $('productModal')
    ? new bootstrap.Modal($('productModal'))
    : null;

  const orderModal = $('orderModal')
    ? new bootstrap.Modal($('orderModal'))
    : null;

  const categoryModal = $('categoryModal')
    ? new bootstrap.Modal($('categoryModal'))
    : null;

  // ======================================================
  // API
  // ======================================================

  async function api(path, options = {}) {
    const config = {
      credentials: 'same-origin',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body instanceof FormData
          ? {}
          : {
              'Content-Type': 'application/json'
            }),
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(path, config);

      const contentType =
        response.headers.get('content-type') || '';

      let data = null;

      if (contentType.includes('application/json')) {
        const text = await response.text();

        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {
            success: false,
            message: 'El servidor devolvió una respuesta JSON inválida.'
          };
        }
      } else {
        const text = await response.text();

        data = {
          success: response.ok,
          message:
            text ||
            `Error HTTP ${response.status}`
        };
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
          `Error HTTP ${response.status}`
        );
      }

      if (data && data.success === false) {
        throw new Error(
          data.message ||
          'La operación no pudo realizarse.'
        );
      }

      return data;
    } catch (error) {
      console.error(`API ${path}:`, error);
      throw error;
    }
  }

  // ======================================================
  // SUBIR IMAGEN
  // ======================================================

  async function uploadProductImage(file) {
    if (!file) {
      return null;
    }

    const formData = new FormData();
    formData.append('image', file);

    const response = await api(
      '/api/upload',
      {
        method: 'POST',
        body: formData
      }
    );

    return response?.data?.image_url ||
           response?.image_url ||
           null;
  }

  // ======================================================
  // SEGURIDAD HTML
  // ======================================================

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  // ======================================================
  // FECHAS
  // ======================================================

  function formatDate(value) {
    if (!value) {
      return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ======================================================
  // ESTADOS PEDIDOS
  // ======================================================

  function statusBadge(status) {
    const labels = {
      pendiente: 'Pendiente',
      confirmado: 'Confirmado',
      completado: 'Completado',
      cancelado: 'Cancelado'
    };

    const safeStatus = escapeHtml(status || '');

    return `
      <span class="status-badge status-${safeStatus}">
        ${labels[status] || safeStatus}
      </span>
    `;
  }

  // ======================================================
  // STOCK
  // ======================================================

  function stockLabel(stock) {
    const quantity = Number(stock || 0);

    if (quantity <= 0) {
      return `
        <span class="stock-pill agotado">
          Agotado
        </span>
      `;
    }

    if (quantity <= 3) {
      return `
        <span class="stock-pill stock_bajo">
          Stock bajo
        </span>
      `;
    }

    return `
      <span class="stock-pill disponible">
        Disponible
      </span>
    `;
  }

  // ======================================================
  // CATEGORÍAS
  // ======================================================

  function renderCategoryOptions() {
    const select = $('productCategorySelect');

    if (!select) {
      return;
    }

    const options = state.categories
      .map(category => `
        <option value="${escapeAttribute(category.id)}">
          ${escapeHtml(category.name)}
        </option>
      `)
      .join('');

    select.innerHTML = `
      <option value="">
        Seleccionar categoría
      </option>
      ${options}
    `;
  }

  function renderCategories() {
    const table = $('categoriesTable');

    if (!table) {
      return;
    }

    table.innerHTML =
      state.categories
        .map(category => `
          <tr>
            <td class="fw-semibold">
              ${escapeHtml(category.name)}
            </td>

            <td>
              ${escapeHtml(
                category.description || '-'
              )}
            </td>

            <td>
              <button
                class="btn btn-sm btn-outline-danger"
                data-action="delete-category"
                data-id="${escapeAttribute(category.id)}">
                Eliminar
              </button>
            </td>
          </tr>
        `)
        .join('') ||
      `
        <tr>
          <td colspan="3"
              class="text-center text-body-secondary py-4">
            No hay categorías
          </td>
        </tr>
      `;
  }

  // ======================================================
  // PRODUCTOS
  // ======================================================

  function renderProducts() {
    const table = $('productsTable');

    if (!table) {
      return;
    }

    const searchInput = $('productSearch');

    const search = searchInput
      ? searchInput.value.trim().toLowerCase()
      : '';

    const filtered = state.products.filter(product => {
      if (!search) {
        return true;
      }

      return [
        product.name,
        product.description,
        product.category_name
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });

    table.innerHTML =
      filtered
        .map(product => `
          <tr>
            <td>
              <div class="fw-semibold">
                ${escapeHtml(product.name)}
              </div>

              <div class="small text-body-secondary">
                ${escapeHtml(
                  product.description || ''
                )}
              </div>
            </td>

            <td>
              ${escapeHtml(
                product.category_name ||
                'Sin categoría'
              )}
            </td>

            <td>
              ${currency.format(
                Number(product.price || 0)
              )}
            </td>

            <td>
              ${Number(
                product.stock_quantity || 0
              )}
            </td>

            <td>
              ${stockLabel(
                product.stock_quantity
              )}

              ${
                product.is_active
                  ? `
                    <span class="badge text-bg-success ms-1">
                      Activo
                    </span>
                  `
                  : `
                    <span class="badge text-bg-secondary ms-1">
                      Inactivo
                    </span>
                  `
              }
            </td>

            <td>
              <div class="d-flex gap-2 flex-wrap">

                <button
                  class="btn btn-sm btn-outline-primary"
                  data-action="edit-product"
                  data-id="${escapeAttribute(product.id)}">
                  Editar
                </button>

                <button
                  class="btn btn-sm btn-outline-warning"
                  data-action="toggle-product"
                  data-id="${escapeAttribute(product.id)}">
                  ${
                    product.is_active
                      ? 'Ocultar'
                      : 'Mostrar'
                  }
                </button>

                <button
                  class="btn btn-sm btn-outline-danger"
                  data-action="delete-product"
                  data-id="${escapeAttribute(product.id)}">
                  Eliminar
                </button>

              </div>
            </td>
          </tr>
        `)
        .join('') ||
      `
        <tr>
          <td colspan="6"
              class="text-center text-body-secondary py-4">
            No hay productos
          </td>
        </tr>
      `;
  }

  // ======================================================
  // PEDIDOS
  // ======================================================

  function renderOrders() {
    const table = $('ordersTable');

    if (!table) {
      return;
    }

    table.innerHTML =
      state.orders
        .map(order => `
          <tr>

            <td>
              #${escapeHtml(order.id)}
            </td>

            <td>
              ${escapeHtml(
                order.customer_name || '-'
              )}
            </td>

            <td>
              ${escapeHtml(
                order.customer_phone || '-'
              )}
            </td>

            <td>
              ${currency.format(
                Number(order.total_amount || 0)
              )}
            </td>

            <td>
              ${statusBadge(order.status)}
            </td>

            <td>
              ${formatDate(order.created_at)}
            </td>

            <td>

              <div class="d-flex gap-2 flex-wrap">

                <button
                  class="btn btn-sm btn-outline-primary"
                  data-action="view-order"
                  data-id="${escapeAttribute(order.id)}">
                  Ver
                </button>

                <select
                  class="form-select form-select-sm"
                  data-action="order-status"
                  data-id="${escapeAttribute(order.id)}"
                  style="width:auto;min-width:140px;">

                  <option value="pendiente"
                    ${
                      order.status === 'pendiente'
                        ? 'selected'
                        : ''
                    }>
                    Pendiente
                  </option>

                  <option value="confirmado"
                    ${
                      order.status === 'confirmado'
                        ? 'selected'
                        : ''
                    }>
                    Confirmado
                  </option>

                  <option value="completado"
                    ${
                      order.status === 'completado'
                        ? 'selected'
                        : ''
                    }>
                    Completado
                  </option>

                  <option value="cancelado"
                    ${
                      order.status === 'cancelado'
                        ? 'selected'
                        : ''
                    }>
                    Cancelado
                  </option>

                </select>

              </div>

            </td>

          </tr>
        `)
        .join('') ||
      `
        <tr>
          <td colspan="7"
              class="text-center text-body-secondary py-4">
            No hay pedidos
          </td>
        </tr>
      `;
  }

  // ======================================================
  // CLIENTES
  // ======================================================

  function renderCustomers() {
    const table = $('customersTable');

    if (!table) {
      return;
    }

    table.innerHTML =
      state.customers
        .map(customer => `
          <tr>

            <td class="fw-semibold">
              ${escapeHtml(customer.name)}
            </td>

            <td>
              ${escapeHtml(
                customer.phone || '-'
              )}
            </td>

            <td>
              ${escapeHtml(
                customer.email || '-'
              )}
            </td>

            <td>
              ${escapeHtml(
                customer.address || '-'
              )}
            </td>

            <td>
              ${Number(
                customer.orders_count || 0
              )}
            </td>

            <td>
              ${currency.format(
                Number(
                  customer.total_spent || 0
                )
              )}
            </td>

            <td>
              ${formatDate(
                customer.last_order_at
              )}
            </td>

            <td>

              <button
                class="btn btn-sm btn-outline-danger"
                data-action="delete-customer"
                data-name="${escapeAttribute(customer.name)}"
                data-phone="${escapeAttribute(customer.phone || '')}"
                data-email="${escapeAttribute(customer.email || '')}"
                data-address="${escapeAttribute(customer.address || '')}">
                Eliminar
              </button>

            </td>

          </tr>
        `)
        .join('') ||
      `
        <tr>
          <td colspan="8"
              class="text-center text-body-secondary py-4">
            No hay clientes
          </td>
        </tr>
      `;
  }

  // ======================================================
  // ESTADÍSTICAS
  // ======================================================

  function updateStats(stats = {}) {
    if ($('productsTotal')) {
      $('productsTotal').textContent =
        stats.products_total ?? 0;
    }

    if ($('productsActive')) {
      $('productsActive').textContent =
        stats.products_active ?? 0;
    }

    if ($('ordersPending')) {
      $('ordersPending').textContent =
        stats.orders_pending ?? 0;
    }

    if ($('totalRevenue')) {
      $('totalRevenue').textContent =
        currency.format(
          Number(stats.total_revenue || 0)
        );
    }
  }

  // ======================================================
  // FORMULARIO PRODUCTO
  // ======================================================

  function fillProductForm(product = null) {
    const form = $('productForm');

    if (!form) {
      return;
    }

    form.reset();

    state.editingProductId =
      product?.id || null;

    if ($('productModalTitle')) {
      $('productModalTitle').textContent =
        product
          ? 'Editar producto'
          : 'Crear producto';
    }

    if (form.elements.id) {
      form.elements.id.value =
        product?.id || '';
    }

    if (form.elements.name) {
      form.elements.name.value =
        product?.name || '';
    }

    if (form.elements.description) {
      form.elements.description.value =
        product?.description || '';
    }

    if (form.elements.price) {
      form.elements.price.value =
        product?.price ?? '';
    }

    if (form.elements.stock_quantity) {
      form.elements.stock_quantity.value =
        product?.stock_quantity ?? 0;
    }

    if (form.elements.image_url) {
      form.elements.image_url.value =
        product?.image_url || '';
    }

    if (form.elements.category_id) {
      form.elements.category_id.value =
        product?.category_id || '';
    }

    if ($('productIsActive')) {
      $('productIsActive').checked =
        product
          ? Boolean(product.is_active)
          : true;
    }

    if (form.elements.image_file) {
      form.elements.image_file.value = '';
    }
  }

  // ======================================================
  // SESIÓN
  // ======================================================

  async function loadSession() {
    const response =
      await api('/api/session');

    if (!response.success) {
      throw new Error(
        response.message ||
        'No hay sesión activa.'
      );
    }

    state.session =
      response.data || {};

    if ($('currentUsernameField')) {
      $('currentUsernameField').value =
        state.session.username ||
        'admin';
    }
  }

  // ======================================================
  // CARGAR DATOS
  // ======================================================

  async function loadStats() {
    const response =
      await api('/api/dashboard');

    updateStats(
      response.data || {}
    );
  }

  async function loadCategories() {
    const response =
      await api('/api/categories');

    state.categories =
      Array.isArray(response.data)
        ? response.data
        : [];

    renderCategoryOptions();
    renderCategories();
  }

  async function loadProducts() {
    const response =
      await api(
        '/api/products?include_inactive=true'
      );

    state.products =
      Array.isArray(response.data)
        ? response.data
        : [];

    renderProducts();
  }

  async function loadOrders() {
    const response =
      await api('/api/orders');

    state.orders =
      Array.isArray(response.data)
        ? response.data
        : [];

    renderOrders();
  }

  async function loadCustomers() {
    const response =
      await api('/api/customers');

    state.customers =
      Array.isArray(response.data)
        ? response.data
        : [];

    renderCustomers();
  }

  async function refreshAll() {
    await Promise.all([
      loadStats(),
      loadCategories(),
      loadProducts(),
      loadOrders(),
      loadCustomers()
    ]);
  }

  // ======================================================
  // LOGOUT
  // ======================================================

  if ($('logoutBtn')) {
    $('logoutBtn').addEventListener(
      'click',
      async () => {
        try {
          await api(
            '/api/logout',
            {
              method: 'POST'
            }
          );
        } catch (error) {
          console.error(error);
        } finally {
          window.location.href =
            '/admin/login.html';
        }
      }
    );
  }

  // ======================================================
  // ACTUALIZAR PRODUCTOS
  // ======================================================

  if ($('refreshProducts')) {
    $('refreshProducts').addEventListener(
      'click',
      async () => {
        try {
          await loadProducts();
        } catch (error) {
          alert(error.message);
        }
      }
    );
  }

  if ($('productSearch')) {
    $('productSearch').addEventListener(
      'input',
      renderProducts
    );
  }

  // ======================================================
  // PRODUCTO CREAR / EDITAR
  // ======================================================

  if ($('productForm')) {
    $('productForm').addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        const form = event.target;

        const submitButton =
          form.querySelector(
            'button[type="submit"]'
          );

        try {
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent =
              'Guardando...';
          }

          const formData =
            new FormData(form);

          const payload = {};

          for (const [
            key,
            value
          ] of formData.entries()) {
            if (key !== 'image_file') {
              payload[key] = value;
            }
          }

          payload.price =
            Number(payload.price || 0);

          payload.stock_quantity =
            Number(
              payload.stock_quantity || 0
            );

          payload.is_active =
            $('productIsActive')
              ? $('productIsActive').checked
              : true;

          const imageInput =
            form.elements.image_file;

          const imageFile =
            imageInput &&
            imageInput.files &&
            imageInput.files.length
              ? imageInput.files[0]
              : null;

          if (imageFile) {
            const imageUrl =
              await uploadProductImage(
                imageFile
              );

            if (imageUrl) {
              payload.image_url =
                imageUrl;
            }
          }

          if (state.editingProductId) {
            await api(
              `/api/products/${encodeURIComponent(
                state.editingProductId
              )}`,
              {
                method: 'PUT',
                body: JSON.stringify(payload)
              }
            );
          } else {
            await api(
              '/api/products',
              {
                method: 'POST',
                body: JSON.stringify(payload)
              }
            );
          }

          if (productModal) {
            productModal.hide();
          }

          state.editingProductId = null;

          form.reset();

          await refreshAll();

          alert(
            'Producto guardado correctamente.'
          );

        } catch (error) {
          console.error(error);

          alert(
            error.message ||
            'No se pudo guardar el producto.'
          );
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent =
              'Guardar';
          }
        }
      }
    );

    $('productForm').addEventListener(
      'reset',
      () => {
        state.editingProductId = null;

        if ($('productModalTitle')) {
          $('productModalTitle').textContent =
            'Crear producto';
        }
      }
    );
  }

  // ======================================================
  // CREAR CATEGORÍA
  // ======================================================

  async function createCategory(
    form,
    modal = null
  ) {
    const formData =
      new FormData(form);

    const payload =
      Object.fromEntries(
        formData.entries()
      );

    await api(
      '/api/categories',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );

    form.reset();

    if (modal) {
      modal.hide();
    }

    await refreshAll();

    alert(
      'Categoría creada correctamente.'
    );
  }

  if ($('categoryForm')) {
    $('categoryForm').addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        try {
          await createCategory(
            event.target
          );
        } catch (error) {
          alert(
            error.message ||
            'No se pudo crear la categoría.'
          );
        }
      }
    );
  }

  if ($('categoryQuickForm')) {
    $('categoryQuickForm').addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        try {
          await createCategory(
            event.target,
            categoryModal
          );
        } catch (error) {
          alert(
            error.message ||
            'No se pudo crear la categoría.'
          );
        }
      }
    );
  }

  // ======================================================
  // CAMBIAR USUARIO
  // ======================================================

  if ($('changeUsernameForm')) {
    $('changeUsernameForm').addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        try {
          const formData =
            new FormData(event.target);

          const payload =
            Object.fromEntries(
              formData.entries()
            );

          await api(
            '/api/admin/account',
            {
              method: 'PUT',
              body: JSON.stringify({
                current_password:
                  payload.current_password,

                new_username:
                  payload.new_username
              })
            }
          );

          event.target.reset();

          await loadSession();

          alert(
            'Usuario actualizado correctamente.'
          );

        } catch (error) {
          alert(
            error.message ||
            'No se pudo actualizar el usuario.'
          );
        }
      }
    );
  }

  // ======================================================
  // CAMBIAR CONTRASEÑA
  // ======================================================

  if ($('changePasswordForm')) {
    $('changePasswordForm').addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        try {
          const formData =
            new FormData(event.target);

          const payload =
            Object.fromEntries(
              formData.entries()
            );

          if (
            payload.new_password !==
            payload.confirm_password
          ) {
            throw new Error(
              'Las contraseñas nuevas no coinciden.'
            );
          }

          await api(
            '/api/admin/account',
            {
              method: 'PUT',
              body: JSON.stringify({
                current_password:
                  payload.current_password,

                new_password:
                  payload.new_password,

                confirm_password:
                  payload.confirm_password
              })
            }
          );

          event.target.reset();

          alert(
            'Contraseña actualizada correctamente.'
          );

        } catch (error) {
          alert(
            error.message ||
            'No se pudo actualizar la contraseña.'
          );
        }
      }
    );
  }

  // ======================================================
  // ACCIONES PRODUCTOS
  // ======================================================

  if ($('productsTable')) {
    $('productsTable').addEventListener(
      'click',
      async event => {
        const button =
          event.target.closest(
            'button[data-action]'
          );

        if (!button) {
          return;
        }

        const id =
          button.dataset.id;

        try {
          if (
            button.dataset.action ===
            'edit-product'
          ) {
            const product =
              state.products.find(
                item =>
                  String(item.id) ===
                  String(id)
              );

            if (!product) {
              return;
            }

            fillProductForm(product);

            if (productModal) {
              productModal.show();
            }

            return;
          }

          if (
            button.dataset.action ===
            'toggle-product'
          ) {
            const product =
              state.products.find(
                item =>
                  String(item.id) ===
                  String(id)
              );

            if (!product) {
              return;
            }

            await api(
              `/api/products/${encodeURIComponent(id)}`,
              {
                method: 'PUT',
                body: JSON.stringify({
                  name: product.name,
                  description:
                    product.description || '',
                  price:
                    Number(product.price || 0),
                  stock_quantity:
                    Number(
                      product.stock_quantity || 0
                    ),
                  image_url:
                    product.image_url || '',
                  category_id:
                    product.category_id || null,
                  is_active:
                    !Boolean(product.is_active)
                })
              }
            );

            await refreshAll();

            return;
          }

          if (
            button.dataset.action ===
            'delete-product'
          ) {
            if (
              !confirm(
                '¿Eliminar este producto?'
              )
            ) {
              return;
            }

            await api(
              `/api/products/${encodeURIComponent(id)}`,
              {
                method: 'DELETE'
              }
            );

            await refreshAll();
          }

        } catch (error) {
          alert(
            error.message ||
            'No se pudo completar la operación.'
          );
        }
      }
    );
  }

  // ======================================================
  // CATEGORÍAS
  // ======================================================

  if ($('categoriesTable')) {
    $('categoriesTable').addEventListener(
      'click',
      async event => {
        const button =
          event.target.closest(
            'button[data-action="delete-category"]'
          );

        if (!button) {
          return;
        }

        if (
          !confirm(
            '¿Eliminar esta categoría?'
          )
        ) {
          return;
        }

        try {
          await api(
            `/api/categories/${encodeURIComponent(
              button.dataset.id
            )}`,
            {
              method: 'DELETE'
            }
          );

          await refreshAll();

        } catch (error) {
          alert(
            error.message ||
            'No se pudo eliminar la categoría.'
          );
        }
      }
    );
  }

  // ======================================================
  // ESTADO PEDIDOS
  // ======================================================

  if ($('ordersTable')) {
    $('ordersTable').addEventListener(
      'change',
      async event => {
        const select =
          event.target.closest(
            'select[data-action="order-status"]'
          );

        if (!select) {
          return;
        }

        try {
          await api(
            `/api/orders/${encodeURIComponent(
              select.dataset.id
            )}/status`,
            {
              method: 'PUT',
              body: JSON.stringify({
                status: select.value
              })
            }
          );

          await loadOrders();
          await loadStats();

        } catch (error) {
          alert(
            error.message ||
            'No se pudo actualizar el pedido.'
          );
        }
      }
    );
  }

  // ======================================================
  // DETALLE PEDIDO
  // ======================================================

  if ($('ordersTable')) {
    $('ordersTable').addEventListener(
      'click',
      async event => {
        const button =
          event.target.closest(
            'button[data-action="view-order"]'
          );

        if (!button) {
          return;
        }

        try {
          const response =
            await api(
              `/api/orders/${encodeURIComponent(
                button.dataset.id
              )}`
            );

          const order =
            response.data || {};

          $('orderDetailBody').innerHTML = `
            <div class="row g-3 mb-3">

              <div class="col-md-4">
                <strong>Cliente:</strong>
                ${escapeHtml(
                  order.customer_name || '-'
                )}
              </div>

              <div class="col-md-4">
                <strong>Teléfono:</strong>
                ${escapeHtml(
                  order.customer_phone || '-'
                )}
              </div>

              <div class="col-md-4">
                <strong>Estado:</strong>
                ${statusBadge(order.status)}
              </div>

              <div class="col-md-4">
                <strong>Correo:</strong>
                ${escapeHtml(
                  order.customer_email || '-'
                )}
              </div>

              <div class="col-md-8">
                <strong>Dirección:</strong>
                ${escapeHtml(
                  order.customer_address || '-'
                )}
              </div>

              <div class="col-12">
                <strong>Notas:</strong>
                ${escapeHtml(
                  order.notes || '-'
                )}
              </div>

            </div>

            <div class="table-responsive">

              <table class="table align-middle">

                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                    <th>Notas</th>
                  </tr>
                </thead>

                <tbody>

                  ${
                    (order.items || [])
                      .map(item => `
                        <tr>

                          <td>
                            ${escapeHtml(
                              item.product_name ||
                              'Producto eliminado'
                            )}
                          </td>

                          <td>
                            ${Number(
                              item.quantity || 0
                            )}
                          </td>

                          <td>
                            ${currency.format(
                              Number(
                                item.unit_price || 0
                              )
                            )}
                          </td>

                          <td>
                            ${currency.format(
                              Number(
                                item.subtotal || 0
                              )
                            )}
                          </td>

                          <td>
                            ${escapeHtml(
                              item.item_notes || '-'
                            )}
                          </td>

                        </tr>
                      `)
                      .join('')
                  }

                </tbody>

              </table>

            </div>
          `;

          if (orderModal) {
            orderModal.show();
          }

        } catch (error) {
          alert(
            error.message ||
            'No se pudo cargar el pedido.'
          );
        }
      }
    );
  }

  // ======================================================
  // CLIENTES
  // ======================================================

  if ($('customersTable')) {
    $('customersTable').addEventListener(
      'click',
      async event => {
        const button =
          event.target.closest(
            'button[data-action="delete-customer"]'
          );

        if (!button) {
          return;
        }

        const name =
          button.dataset.name || '';

        const phone =
          button.dataset.phone || '';

        const email =
          button.dataset.email || '';

        const address =
          button.dataset.address || '';

        if (
          !confirm(
            `¿Eliminar el cliente ${name}? Se borrarán sus pedidos asociados.`
          )
        ) {
          return;
        }

        try {
          const params =
            new URLSearchParams();

          if (phone) {
            params.set(
              'phone',
              phone
            );
          }

          if (email) {
            params.set(
              'email',
              email
            );
          }

          if (address) {
            params.set(
              'address',
              address
            );
          }

          const query =
            params.toString();

          const url =
            `/api/customers/${encodeURIComponent(
              name
            )}` +
            (query ? `?${query}` : '');

          await api(
            url,
            {
              method: 'DELETE'
            }
          );

          await refreshAll();

        } catch (error) {
          alert(
            error.message ||
            'No se pudo eliminar el cliente.'
          );
        }
      }
    );
  }

  // ======================================================
  // RELOJ
  // ======================================================

  function updateClock() {
    if (!$('adminDatetime')) {
      return;
    }

    $('adminDatetime').textContent =
      new Date().toLocaleString(
        'es-CO',
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }

  // ======================================================
  // BOTÓN CREAR PRODUCTO
  // ======================================================

  const createProductButtons =
    document.querySelectorAll(
      '[data-bs-target="#productModal"]'
    );

  createProductButtons.forEach(button => {
    button.addEventListener(
      'click',
      () => {
        fillProductForm();
      }
    );
  });

  // ======================================================
  // INICIALIZACIÓN
  // ======================================================

  (async () => {
    try {
      await loadSession();

      updateClock();

      setInterval(
        updateClock,
        60000
      );

      await refreshAll();

    } catch (error) {
      console.error(
        'Error inicializando dashboard:',
        error
      );

      window.location.href =
        '/admin/login.html';
    }
  })();
});