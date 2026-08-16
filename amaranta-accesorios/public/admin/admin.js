document.addEventListener('DOMContentLoaded', function() {
  checkAuth();

  function actualizarFechaHora() {
    const reloj = document.getElementById('admin-fecha-hora');
    if (!reloj) return;

    const ahora = new Date();
    reloj.textContent = ahora.toLocaleString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function checkAuth() {
    const response = await fetch('/api/session');
    const data = await response.json();
    if (!data.success) window.location.href = '/admin/login.html';
  }

  // Cargar estadísticas
  async function cargarEstadisticas() {
    const response = await fetch('/api/dashboard');
    const data = await response.json();
    if (data.success && data.data) {
      const s = data.data;
      document.getElementById('estadisticas-productos-totales').textContent = s.productos_totales || 0;
      document.getElementById('estadisticas-productos-activos').textContent = s.productos_activos || 0;
      document.getElementById('estadisticas-pedidos-totales').textContent = s.pedidos_totales || 0;
      document.getElementById('estadisticas-pedidos-pendientes').textContent = s.pedidos_pendientes || 0;
    }
  }

  // Cargar productos
  async function cargarProductos() {
    const response = await fetch('/api/products?include_inactive=false');
    const data = await response.json();
    if (data.success && data.data) renderizarProductos(data.data);
  }

  function renderizarProductos(productos) {
    const tbody = document.getElementById('tabla-productos');
    tbody.innerHTML = productos.map(p => `
      <tr>
        <td>${p.id}</td>
        <td><img src="${p.url_imagen || ''}" width="30" style="border-radius:4px; vertical-align:middle;"> ${p.nombre}</td>
        <td>${p.categoria_nombre || 'Sin categoría'}</td>
        <td>$${p.precio.toFixed(2)}</td>
        <td><span class="status-badge ${p.cantidad_stock <= 0 ? 'status-cancelado' : p.cantidad_stock <= 3 ? 'status-pendiente' : 'status-confirmado'}">${p.cantidad_stock <= 0 ? 'Agotado' : p.cantidad_stock <= 3 ? 'Stock Bajo' : 'Disponible'}</span></td>
        <td><span class="status-badge ${p.activo ? 'status-confirmado' : 'status-pendiente'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editarProducto(${p.id})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  }

  // Cargar categorías en form
  async function cargarCategoriasForm() {
    const response = await fetch('/api/categories');
    const data = await response.json();
    if (data.success && data.data) {
      const options = data.data.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
      document.querySelectorAll('select[name="categoria"]').forEach(s => s.innerHTML = '<option value="">Seleccionar</option>' + options);
    }
  }

  // Subir imagen al servidor
  async function subirImagen(file) {
    const formData = new FormData();
    formData.append('imagen', file);
    const resp = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    });
    const result = await resp.json();
    if (result.success) {
      return result.url_imagen;
    } else {
      alert('Error al subir imagen: ' + result.message);
      return null;
    }
  }

  // Agregar producto
  if (document.getElementById('form-producto')) {
    document.getElementById('form-producto').addEventListener('submit', async e => {
      e.preventDefault();

      let urlImagen = e.target.imagen.value || null;
      let tipoImagen = 'url';

      // Si se seleccionó un archivo, subirlo
      const archivoInput = e.target.archivo_imagen;
      if (archivoInput && archivoInput.files && archivoInput.files.length > 0) {
        const urlSubida = await subirImagen(archivoInput.files[0]);
        if (urlSubida) {
          urlImagen = urlSubida;
          tipoImagen = 'upload';
        } else {
          return;
        }
      }

      const data = {
        nombre: e.target.nombre.value,
        descripcion: e.target.descripcion.value,
        precio: parseFloat(e.target.precio.value),
        cantidad_stock: parseInt(e.target.stock.value),
        url_imagen: urlImagen,
        tipo_imagen: tipoImagen,
        categoria_id: parseInt(e.target.categoria.value) || null,
        activo: e.target.is_active.checked
      };
      const resp = await fetch('/api/products', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
      const result = await resp.json();
      if (result.success) { alert('Producto agregado'); bootstrap.Modal.getInstance(document.getElementById('modal-agregar-producto')).hide(); e.target.reset(); cargarProductos(); cargarEstadisticas(); }
      else alert('Error: ' + result.message);
    });
  }

  // Editar producto
  window.editarProducto = function(id) {
    fetch('/api/products/' + id)
      .then(r => r.json())
      .then(p => {
        document.getElementById('form-editar-producto')['producto-id'].value = p.id;
        document.getElementById('form-editar-producto')['nombre'].value = p.nombre;
        document.getElementById('form-editar-producto')['descripcion'].value = p.descripcion;
        document.getElementById('form-editar-producto')['precio'].value = p.precio;
        document.getElementById('form-editar-producto')['stock'].value = p.cantidad_stock;
        document.getElementById('form-editar-producto')['imagen'].value = p.url_imagen || '';
        cargarCategoriasForm().then(() => {
          const catSelect = document.getElementById('form-editar-producto select[name="categoria"]');
          const opt = Array.from(catSelect.options).find(o => o.value === p.categoria_id || o.text === (p.categoria_nombre || ''));
          if (opt) catSelect.value = opt.value;
        });
        document.getElementById('modal-editar-producto').style.display = 'block';
      });
  };

  // Guardar edición de producto
  if (document.getElementById('form-editar-producto')) {
    document.getElementById('form-editar-producto').addEventListener('submit', async e => {
      e.preventDefault();

      let urlImagen = e.target.imagen.value || null;
      let tipoImagen = 'url';

      const archivoInput = e.target.archivo_imagen;
      if (archivoInput && archivoInput.files && archivoInput.files.length > 0) {
        const urlSubida = await subirImagen(archivoInput.files[0]);
        if (urlSubida) {
          urlImagen = urlSubida;
          tipoImagen = 'upload';
        } else {
          return;
        }
      }

      const data = {
        nombre: e.target.nombre.value,
        descripcion: e.target.descripcion.value,
        precio: parseFloat(e.target.precio.value),
        cantidad_stock: parseInt(e.target.stock.value),
        url_imagen: urlImagen,
        tipo_imagen: tipoImagen,
        categoria_id: parseInt(e.target.categoria.value) || null,
        activo: e.target.is_active.checked
      };
      const resp = await fetch('/api/products/' + e.target['producto-id'].value, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
      const result = await resp.json();
      if (result.success) { alert('Producto actualizado'); bootstrap.Modal.getInstance(document.getElementById('modal-editar-producto')).hide(); e.target.reset(); cargarProductos(); cargarEstadisticas(); }
      else alert('Error: ' + result.message);
    });
  }

  // Eliminar producto
  window.eliminarProducto = function(id) {
    if (confirm('¿Eliminar producto?')) {
      fetch('/api/products/' + id, {method: 'DELETE'})
        .then(r => r.json())
        .then(r => { if (r.success) { alert('Eliminado'); cargarProductos(); cargarEstadisticas(); } else alert('Error: ' + r.message); });
    }
  };

  // Cambiar estado
  window.cambiarEstado = function(id) {
    fetch('/api/products/' + id + '/estado', {method: 'PUT', headers: {'Content-Type': 'application/json'}})
      .then(r => r.json())
      .then(r => { if (r.success) { alert('Estado actualizado'); cargarProductos(); cargarEstadisticas(); } else alert('Error: ' + r.message); });
  };

  // Cargar pedidos
  async function cargarPedidos() {
    const response = await fetch('/api/orders');
    const data = await response.json();
    if (data.success && data.data) renderizarPedidos(data.data);
  }

  function renderizarPedidos(pedidos) {
    const tbody = document.getElementById('tabla-pedidos');
    tbody.innerHTML = pedidos.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.nombre_cliente}</td>
        <td>${p.telefono_cliente || '-'}</td>
        <td>$${p.total.toFixed(2)}</td>
        <td><span class="status-badge ${getEstadoClass(p.estado)}">${getEstadoTexto(p.estado)}</span></td>
        <td>${new Date(p.creado_en).toLocaleDateString('es-CO')}</td>
        <td><button class="btn btn-sm btn-primary" onclick="verDetallePedido(${p.id})">Ver</button></td>
      </tr>
    `).join('');
  }

  function getEstadoClass(e) { const m = {pendiente: 'status-pendiente', confirmado: 'status-confirmado', completado: 'status-completado', cancelado: 'status-cancelado'}; return m[e] || 'status-pendiente'; }
  function getEstadoTexto(e) { const m = {pendiente: 'Pendiente', confirmado: 'Confirmado', completado: 'Completado', cancelado: 'Cancelado'}; return m[e] || 'Pendiente'; }

  window.verDetallePedido = function(id) {
    fetch('/api/orders/' + id)
      .then(r => r.json())
      .then(p => {
        const items = p.order_items.map(i => `<tr><td>${i.producto_id}</td><td>${i.name || 'Producto'}</td><td>${i.cantidad}</td><td>$${i.precio_unitario.toFixed(2)}</td><td>$${i.subtotal.toFixed(2)}</td></tr>`).join('');
        document.getElementById('detalle-pedido-body').innerHTML = `<tr><td colspan="5"><strong>Pedido #${p.id}</strong><br>Cliente: ${p.nombre_cliente}<br>Tel: ${p.telefono_cliente || 'N/A'}<br>Email: ${p.email_cliente || 'N/A'}<br>Dir: ${p.direccion_cliente || 'N/A'}<br>Notas: ${p.notas || 'N/A'}<br>Total: $${p.total.toFixed(2)}<br>Estado: <span class="status-badge ${getEstadoClass(p.estado)}">${getEstadoTexto(p.estado)}</span></td></tr>${items}`;
        new bootstrap.Modal(document.getElementById('modal-pedido-detalle')).show();
      });
  };

  // Cargar clientes
  async function cargarClientes() {
    const response = await fetch('/api/customers');
    const data = await response.json();
    if (data.success && data.data) {
      let html = '';
      data.data.forEach(c => {
        const tp = c.pedidos_count || 0, tc = c.total_comprado || 0, up = c.ultimo_pedido ? new Date(c.ultimo_pedido).toLocaleDateString('es-CO') : 'N/A';
        html += `<tr><td>${c.nombre}</td><td>${c.telefono || '-'}</td><td>${c.email || '-'}</td><td>${c.direccion || '-'}</td><td>${tp}</td><td>$${tc.toFixed(2)}</td><td>${up}</td></tr>`;
      });
      console.log('Clientes:', html);
    }
  }

  // Cargar categorías admin
  async function cargarCategoriasAdmin() {
    const response = await fetch('/api/categories');
    const data = await response.json();
    if (data.success && data.data) {
      const cont = document.getElementById('contenedor-categorias');
      if (cont) {
        cont.innerHTML = data.data.map(c => `<div class="mb-3 p-3 border rounded" style="background: var(--light-gray);"><h6>${c.nombre}</h6><p>${c.descripcion || ''}</p><button class="btn btn-sm btn-primary btn-eliminar-cat" data-id="${c.id}">Eliminar</button></div>`).join('');
        document.querySelectorAll('.btn-eliminar-cat').forEach(b => {
          b.addEventListener('click', function() {
            if (confirm('¿Eliminar categoría?')) {
              const id = this.dataset.id;
              fetch('/api/categories/' + id, {method: 'DELETE'})
                .then(r => r.json())
                .then(r => { if (r.success) { alert('Eliminada'); cargarCategoriasAdmin(); } else alert('Error: ' + r.message); });
            }
          });
        });
      }
    }
  }

  // Inicializar
  actualizarFechaHora();
  setInterval(actualizarFechaHora, 60000);
  cargarEstadisticas();
  cargarProductos();
  cargarPedidos();
  cargarClientes();
  cargarCategoriasForm();
  cargarCategoriasAdmin();
});
