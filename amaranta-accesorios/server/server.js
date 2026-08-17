require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { query, pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARES
// =====================================================

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'amaranta_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8, // 8 horas
    sameSite: 'lax'
  }
}));

// =====================================================
// ARCHIVOS ESTÁTICOS
// =====================================================

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// =====================================================
// SUBIDA DE IMÁGENES
// =====================================================

// En Vercel (serverless) no hay sistema de archivos persistente,
// por lo que usamos memoryStorage y devolvemos la imagen como data URL base64.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/i;
    const ext = path.extname(file.originalname);
    if (!allowed.test(ext)) {
      return cb(new Error('Formato de imagen no permitido'));
    }
    cb(null, true);
  }
});

// =====================================================
// MIDDLEWARE DE AUTENTICACIÓN
// =====================================================

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado. Inicia sesión primero.'
    });
  }
  next();
}

// =====================================================
// RUTA WHATSAPP
// =====================================================

app.get('/whatsapp', (req, res) => {
  const text = req.query.text || 'Hola Amaranta Accesorios';
  const phone = process.env.WHATSAPP_NUMBER || '573000000000';
  res.redirect(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
});

// =====================================================
// AUTENTICACIÓN
// =====================================================

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos'
      });
    }

    const result = await query(
      'SELECT id, username, password FROM users WHERE username = $1 LIMIT 1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username
    };

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: { username: user.username }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión'
      });
    }
    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  });
});

// GET /api/session
app.get('/api/session', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'No hay sesión activa'
    });
  }

  res.json({
    success: true,
    data: {
      id: req.session.user.id,
      username: req.session.user.username
    }
  });
});

// =====================================================
// CATEGORÍAS
// =====================================================

// GET /api/categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, 
        (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c
       ORDER BY c.name ASC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error listando categorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar categorías'
    });
  }
});

// POST /api/categories
app.post('/api/categories', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría es requerido'
      });
    }

    const result = await query(
      `INSERT INTO categories (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), description || '']
    );

    res.status(201).json({
      success: true,
      message: 'Categoría creada correctamente',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una categoría con ese nombre'
      });
    }
    console.error('Error creando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la categoría'
    });
  }
});

// DELETE /api/categories/:id
app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const result = await query(
      'DELETE FROM categories WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Categoría eliminada correctamente'
    });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la categoría'
    });
  }
});

// =====================================================
// PRODUCTOS
// =====================================================

// GET /api/products
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, include_inactive } = req.query;
    const conditions = [];
    const params = [];

    if (!include_inactive || include_inactive !== 'true') {
      conditions.push('p.is_active = true');
    }

    if (category && category !== 'all') {
      params.push(parseInt(category));
      conditions.push(`p.category_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}
       ORDER BY p.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error listando productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar productos'
    });
  }
});

// GET /api/products/:id
app.get('/api/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const result = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el producto'
    });
  }
});

// POST /api/products
app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock_quantity,
      image_url,
      category_id,
      is_active
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del producto es requerido'
      });
    }

    const result = await query(
      `INSERT INTO products (
        name, description, price, stock_quantity,
        image_url, category_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        name.trim(),
        description || '',
        parseFloat(price) || 0,
        parseInt(stock_quantity) || 0,
        image_url || '',
        category_id ? parseInt(category_id) : null,
        is_active !== false
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Producto creado correctamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el producto'
    });
  }
});

// PUT /api/products/:id
app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const {
      name,
      description,
      price,
      stock_quantity,
      image_url,
      category_id,
      is_active
    } = req.body;

    const result = await query(
      `UPDATE products SET
        name = $1,
        description = $2,
        price = $3,
        stock_quantity = $4,
        image_url = $5,
        category_id = $6,
        is_active = $7,
        updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        name || '',
        description || '',
        parseFloat(price) || 0,
        parseInt(stock_quantity) || 0,
        image_url || '',
        category_id ? parseInt(category_id) : null,
        is_active !== false,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Producto actualizado correctamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el producto'
    });
  }
});

// DELETE /api/products/:id
app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const result = await query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Producto eliminado correctamente'
    });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el producto'
    });
  }
});

// =====================================================
// PEDIDOS
// =====================================================

// POST /api/orders
app.post('/api/orders', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      notes,
      items
    } = req.body;

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del cliente es requerido'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El pedido debe contener al menos un producto'
      });
    }

    await client.query('BEGIN');

    // Verificar stock
    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, name, price, stock_quantity, is_active FROM products WHERE id = $1',
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Producto con ID ${item.product_id} no encontrado`);
      }

      const product = productResult.rows[0];

      if (!product.is_active) {
        throw new Error(`El producto "${product.name}" no está disponible`);
      }

      if (product.stock_quantity < item.quantity) {
        throw new Error(`Stock insuficiente para "${product.name}"`);
      }
    }

    // Calcular total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, name, price FROM products WHERE id = $1',
        [item.product_id]
      );

      const product = productResult.rows[0];
      const unitPrice = parseFloat(product.price);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
        item_notes: item.item_notes || ''
      });
    }

    // Crear pedido
    const orderResult = await client.query(
      `INSERT INTO orders (
        customer_name, customer_phone, customer_email,
        customer_address, notes, status, total_amount
      ) VALUES ($1, $2, $3, $4, $5, 'pendiente', $6)
      RETURNING *`,
      [
        customer_name.trim(),
        customer_phone || '',
        customer_email || '',
        customer_address || '',
        notes || '',
        totalAmount
      ]
    );

    const order = orderResult.rows[0];

    // Crear items del pedido
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, quantity, unit_price, subtotal, item_notes
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          order.id,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.subtotal,
          item.item_notes
        ]
      );

      // Descontar stock
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Pedido creado correctamente',
      data: {
        order_id: order.id,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando pedido:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear el pedido'
    });
  } finally {
    client.release();
  }
});

// GET /api/orders
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*,
        (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS items_count
       FROM orders o
       ORDER BY o.created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error listando pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar pedidos'
    });
  }
});

// GET /api/orders/public
app.get('/api/orders/public', async (req, res) => {
  try {
    const { name, phone } = req.query;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y teléfono son requeridos'
      });
    }

    const result = await query(
      `SELECT o.*
       FROM orders o
       WHERE LOWER(o.customer_name) = LOWER($1)
         AND o.customer_phone = $2
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [name, phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró un pedido con esos datos'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error consultando pedido público:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar el pedido'
    });
  }
});

// GET /api/orders/:id
app.get('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const itemsResult = await query(
      `SELECT oi.*, p.name AS product_name, p.image_url
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...orderResult.rows[0],
        items: itemsResult.rows
      }
    });
  } catch (error) {
    console.error('Error obteniendo pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el pedido'
    });
  }
});

// PUT /api/orders/:id/status
app.put('/api/orders/:id/status', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const validStatuses = ['pendiente', 'confirmado', 'completado', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    await client.query('BEGIN');

    // Obtener pedido actual
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const currentOrder = orderResult.rows[0];

    // Si se cancela un pedido que no estaba cancelado, devolver stock
    if (status === 'cancelado' && currentOrder.status !== 'cancelado') {
      const itemsResult = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [id]
      );

      for (const item of itemsResult.rows) {
        if (item.product_id) {
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
      }
    }

    // Si se reactiva un pedido cancelado, descontar stock de nuevo
    if (currentOrder.status === 'cancelado' && status !== 'cancelado') {
      const itemsResult = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [id]
      );

      for (const item of itemsResult.rows) {
        if (item.product_id) {
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
      }
    }

    const result = await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Estado del pedido actualizado correctamente',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando estado del pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el estado del pedido'
    });
  } finally {
    client.release();
  }
});

// =====================================================
// CLIENTES
// =====================================================

// GET /api/customers
app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        o.customer_name AS name,
        o.customer_phone AS phone,
        o.customer_email AS email,
        o.customer_address AS address,
        COUNT(DISTINCT o.id)::int AS orders_count,
        COALESCE(SUM(o.total_amount), 0) AS total_spent,
        MAX(o.created_at) AS last_order_at
       FROM orders o
       GROUP BY o.customer_name, o.customer_phone, o.customer_email, o.customer_address
       ORDER BY last_order_at DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error listando clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar clientes'
    });
  }
});

// DELETE /api/customers/:name
app.delete('/api/customers/:name', requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const name = req.params.name;
    const { phone, email, address } = req.query;

    await client.query('BEGIN');

    // Encontrar pedidos del cliente
    const conditions = ['LOWER(customer_name) = LOWER($1)'];
    const params = [name];

    if (phone) {
      params.push(phone);
      conditions.push(`customer_phone = $${params.length}`);
    }

    if (email) {
      params.push(email);
      conditions.push(`customer_email = $${params.length}`);
    }

    if (address) {
      params.push(address);
      conditions.push(`customer_address = $${params.length}`);
    }

    const ordersResult = await client.query(
      `SELECT id FROM orders WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (ordersResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Devolver stock de los pedidos no cancelados
    for (const order of ordersResult.rows) {
      const orderDetail = await client.query(
        'SELECT status FROM orders WHERE id = $1',
        [order.id]
      );

      if (orderDetail.rows[0].status !== 'cancelado') {
        const itemsResult = await client.query(
          'SELECT * FROM order_items WHERE order_id = $1',
          [order.id]
        );

        for (const item of itemsResult.rows) {
          if (item.product_id) {
            await client.query(
              'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
              [item.quantity, item.product_id]
            );
          }
        }
      }
    }

    // Eliminar pedidos del cliente
    await client.query(
      `DELETE FROM orders WHERE ${conditions.join(' AND ')}`,
      params
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Cliente eliminado correctamente'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error eliminando cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el cliente'
    });
  } finally {
    client.release();
  }
});

// =====================================================
// DASHBOARD
// =====================================================

// GET /api/dashboard
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const [productsResult, ordersResult, revenueResult, lowStockResult] = await Promise.all([
      query('SELECT COUNT(*)::int AS total FROM products'),
      query('SELECT COUNT(*)::int AS total FROM orders WHERE status = $1', ['pendiente']),
      query('SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE status != $1', ['cancelado']),
      query('SELECT COUNT(*)::int AS total FROM products WHERE stock_quantity <= 3 AND is_active = true')
    ]);

    const activeResult = await query(
      'SELECT COUNT(*)::int AS total FROM products WHERE is_active = true'
    );

    res.json({
      success: true,
      data: {
        products_total: productsResult.rows[0].total,
        products_active: activeResult.rows[0].total,
        orders_pending: ordersResult.rows[0].total,
        total_revenue: revenueResult.rows[0].total,
        low_stock: lowStockResult.rows[0].total
      }
    });
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

// =====================================================
// CUENTA ADMIN
// =====================================================

// PUT /api/admin/account
app.put('/api/admin/account', requireAuth, async (req, res) => {
  try {
    const { current_password, new_username, new_password, confirm_password } = req.body;

    if (!current_password) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña actual es requerida'
      });
    }

    // Verificar contraseña actual
    const userResult = await query(
      'SELECT id, username, password FROM users WHERE id = $1',
      [req.session.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = userResult.rows[0];
    const valid = await bcrypt.compare(current_password, user.password);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Cambiar nombre de usuario
    if (new_username) {
      if (new_username.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'El nombre de usuario debe tener al menos 3 caracteres'
        });
      }

      await query(
        'UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2',
        [new_username.trim(), user.id]
      );

      req.session.user.username = new_username.trim();

      return res.json({
        success: true,
        message: 'Usuario actualizado correctamente'
      });
    }

    // Cambiar contraseña
    if (new_password) {
      if (new_password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres'
        });
      }

      if (new_password !== confirm_password) {
        return res.status(400).json({
          success: false,
          message: 'Las contraseñas no coinciden'
        });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);

      await query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, user.id]
      );

      return res.json({
        success: true,
        message: 'Contraseña actualizada correctamente'
      });
    }

    res.status(400).json({
      success: false,
      message: 'No se especificó qué cambiar'
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Ese nombre de usuario ya está en uso'
      });
    }
    console.error('Error actualizando cuenta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la cuenta'
    });
  }
});

// =====================================================
// SUBIR IMAGEN
// =====================================================

// POST /api/upload
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ninguna imagen'
      });
    }

    // Convertir la imagen a data URL base64 para almacenarla en la BD
    const mimeType = req.file.mimetype;
    const base64 = req.file.buffer.toString('base64');
    const imageUrl = `data:${mimeType};base64,${base64}`;

    res.json({
      success: true,
      message: 'Imagen subida correctamente',
      data: { image_url: imageUrl }
    });
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al subir la imagen'
    });
  }
});

// =====================================================
// RUTA PRINCIPAL
// =====================================================

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// =====================================================
// MANEJO DE ERRORES 404
// =====================================================

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: 'Ruta no encontrada'
    });
  }
  res.status(404).sendFile(path.join(publicDir, 'index.html'));
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

// En Vercel (serverless) no se debe llamar a app.listen().
// Solo se ejecuta localmente con `npm start` o `npm run dev`.
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  AMARANTA ACCESORIOS');
    console.log('========================================');
    console.log(`  Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`  Catálogo: http://localhost:${PORT}`);
    console.log(`  Admin: http://localhost:${PORT}/admin/login.html`);
    console.log('========================================');
  });
}

module.exports = app;
