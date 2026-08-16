require('dotenv').config();

const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { query, pool } = require('./db');

const app = express();

const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, '..', 'public');
const uploadDir = path.join(publicDir, 'images', 'uploads');

// ======================================================
// CONFIGURACIÓN GENERAL
// ======================================================

app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({
  limit: '2mb',
}));

app.use(express.urlencoded({
  extended: true,
}));

// ======================================================
// CARPETA DE IMÁGENES
// ======================================================
//
// IMPORTANTE:
// Esta carpeta funciona para desarrollo local.
// En Vercel, el almacenamiento local NO debe utilizarse
// como almacenamiento permanente.
//
// Para producción se recomienda Vercel Blob, Cloudinary
// u otro almacenamiento externo.
// ======================================================

if (!process.env.VERCEL) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// ======================================================
// MULTER
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const safeName =
      `producto-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

    cb(null, safeName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      '.png',
      '.jpg',
      '.jpeg',
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (allowed.includes(extension)) {
      cb(null, true);
      return;
    }

    cb(
      new Error('Formato de imagen no permitido. Usa PNG, JPG o JPEG.'),
      false
    );
  },
});

// ======================================================
// SESIONES
// ======================================================

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    rolling: true,

    cookie: {
      httpOnly: true,
      secure: process.env.VERCEL === '1',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function sendPublicFile(res, fileName) {
  return res.sendFile(
    path.join(publicDir, fileName)
  );
}

function buildWhatsAppRedirect(text) {
  const message =
    text ||
    'Hola Amaranta Accesorios, quiero obtener información sobre sus productos.';

  return `https://wa.me/573113353145?text=${encodeURIComponent(message)}`;
}

function requireApiAuth(req, res, next) {
  if (req.session?.user?.id) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'No autenticado',
  });
}

function requirePageAuth(req, res, next) {
  if (req.session?.user?.id) {
    return next();
  }

  return res.redirect('/admin/login.html');
}

function toInt(value) {
  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed)
    ? null
    : parsed;
}

function normalizeAuthPayload(body) {
  return {
    username:
      body.username ||
      body.nombre_usuario ||
      '',

    password:
      body.password ||
      body.contrasena ||
      '',
  };
}

function normalizeProductPayload(body) {
  return {
    name:
      body.name ||
      body.nombre ||
      '',

    description:
      body.description ||
      body.descripcion ||
      '',

    price:
      Number(
        body.price ??
        body.precio ??
        0
      ),

    stockQuantity:
      Number.parseInt(
        body.stock_quantity ??
        body.cantidad_stock ??
        0,
        10
      ) || 0,

    imageUrl:
      body.image_url ||
      body.url_imagen ||
      '',

    categoryId:
      toInt(
        body.category_id ??
        body.categoria_id
      ),

    isActive:
      body.is_active !== undefined
        ? (
            body.is_active === true ||
            body.is_active === 'true' ||
            body.is_active === '1'
          )
        : body.activo !== undefined
          ? (
              body.activo === true ||
              body.activo === 'true' ||
              body.activo === '1'
            )
          : true,
  };
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      productId:
        toInt(
          item.product_id ??
          item.productId
        ),

      quantity:
        Number.parseInt(
          item.quantity ??
          item.cantidad ??
          0,
          10
        ) || 0,

      itemNotes:
        item.item_notes ||
        item.notes ||
        '',

      itemSize:
        item.item_size ||
        item.size ||
        '',
    }))
    .filter(
      (item) =>
        item.productId &&
        item.quantity > 0
    );
}

// ======================================================
// PÁGINAS
// ======================================================

app.get('/', (req, res) => {
  return sendPublicFile(
    res,
    'index.html'
  );
});

app.get('/admin', (req, res) => {
  return res.redirect(
    '/admin/login.html'
  );
});

app.get(
  '/admin/dashboard.html',
  requirePageAuth,
  (req, res) => {
    return sendPublicFile(
      res,
      path.join(
        'admin',
        'dashboard.html'
      )
    );
  }
);

// ======================================================
// SESIÓN
// ======================================================

app.get('/api/session', (req, res) => {
  if (req.session?.user?.id) {
    return res.json({
      success: true,
      data: req.session.user,
    });
  }

  return res.json({
    success: false,
    message: 'No hay sesión activa',
  });
});

// ======================================================
// WHATSAPP
// ======================================================

app.get('/whatsapp', (req, res) => {
  const text =
    req.query.text ||
    'Hola Amaranta Accesorios, quiero obtener información sobre sus productos.';

  return res.redirect(
    buildWhatsAppRedirect(text)
  );
});

// ======================================================
// LOGIN
// ======================================================

app.post('/api/login', async (req, res) => {
  const {
    username,
    password,
  } = normalizeAuthPayload(req.body);

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message:
        'Usuario y contraseña son requeridos',
    });
  }

  try {
    const result = await query(
      `
      SELECT
        id,
        username,
        password
      FROM users
      WHERE username = $1
      `,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message:
          'Usuario o contraseña incorrectos',
      });
    }

    const user = result.rows[0];

    const matches =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!matches) {
      return res.status(401).json({
        success: false,
        message:
          'Usuario o contraseña incorrectos',
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
    };

    return res.json({
      success: true,
      data: req.session.user,
      message:
        'Inicio de sesión exitoso',
    });

  } catch (error) {
    console.error(
      'Error en login:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error en el servidor',
    });
  }
});

// ======================================================
// LOGOUT
// ======================================================

app.get('/api/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message:
          'No se pudo cerrar la sesión',
      });
    }

    res.clearCookie(
      'connect.sid'
    );

    return res.json({
      success: true,
      message:
        'Sesión cerrada correctamente',
    });
  });
});

// ======================================================
// SUBIDA DE IMÁGENES
// ======================================================

app.post(
  '/api/upload-image',
  requireApiAuth,
  upload.single('image'),
  (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          'No se subió ninguna imagen',
      });
    }

    return res.json({
      success: true,

      data: {
        image_url:
          `/images/uploads/${req.file.filename}`,
      },
    });
  }
);

// ======================================================
// PRODUCTOS
// ======================================================

app.get('/api/products', async (req, res) => {
  try {
    const includeInactive =
      req.query.include_inactive === 'true';

    const category =
      req.query.category;

    const search =
      (req.query.search || '').trim();

    const filters = [];
    const params = [];

    if (!includeInactive) {
      filters.push(
        'p.is_active = true'
      );
    }

    if (category) {
      const categoryId =
        toInt(category);

      if (categoryId) {
        params.push(categoryId);

        filters.push(
          `p.category_id = $${params.length}`
        );
      } else {
        params.push(category);

        filters.push(
          `LOWER(c.name) = LOWER($${params.length})`
        );
      }
    }

    if (search) {
      params.push(
        `%${search}%`
      );

      filters.push(
        `(p.name ILIKE $${params.length}
        OR COALESCE(p.description, '') ILIKE $${params.length})`
      );
    }

    const whereClause =
      filters.length
        ? `WHERE ${filters.join(' AND ')}`
        : '';

    const result = await query(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock_quantity,
        p.image_url,
        p.category_id,
        c.name AS category_name,
        p.is_active,
        p.created_at,
        p.updated_at,

        CASE
          WHEN p.stock_quantity = 0
            THEN 'agotado'

          WHEN p.stock_quantity <= 3
            THEN 'stock_bajo'

          ELSE 'disponible'
        END AS stock_status

      FROM products p

      LEFT JOIN categories c
        ON c.id = p.category_id

      ${whereClause}

      ORDER BY
        p.created_at DESC,
        p.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      data: result.rows,
    });

  } catch (error) {
    console.error(
      'Error al obtener productos:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error en el servidor',
    });
  }
});

app.get(
  '/api/products/:id',
  async (req, res) => {
    try {
      const result = await query(
        `
        SELECT
          p.id,
          p.name,
          p.description,
          p.price,
          p.stock_quantity,
          p.image_url,
          p.category_id,
          c.name AS category_name,
          p.is_active,
          p.created_at,
          p.updated_at

        FROM products p

        LEFT JOIN categories c
          ON c.id = p.category_id

        WHERE p.id = $1
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            'Producto no encontrado',
        });
      }

      return res.json({
        success: true,
        data: result.rows[0],
      });

    } catch (error) {
      console.error(
        'Error al obtener producto:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

app.post(
  '/api/products',
  requireApiAuth,
  async (req, res) => {

    const payload =
      normalizeProductPayload(
        req.body
      );

    if (
      !payload.name ||
      !Number.isFinite(payload.price)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Nombre y precio son requeridos',
      });
    }

    try {
      const result = await query(
        `
        INSERT INTO products
        (
          name,
          description,
          price,
          stock_quantity,
          image_url,
          category_id,
          is_active
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )

        RETURNING *
        `,
        [
          payload.name,
          payload.description,
          payload.price,
          payload.stockQuantity,
          payload.imageUrl || null,
          payload.categoryId,
          payload.isActive,
        ]
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        message:
          'Producto creado',
      });

    } catch (error) {
      console.error(
        'Error al crear producto:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

app.put(
  '/api/products/:id',
  requireApiAuth,
  async (req, res) => {

    const payload =
      normalizeProductPayload(
        req.body
      );

    if (
      !payload.name ||
      !Number.isFinite(payload.price)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Nombre y precio son requeridos',
      });
    }

    try {
      const result = await query(
        `
        UPDATE products

        SET
          name = $1,
          description = $2,
          price = $3,
          stock_quantity = $4,
          image_url = $5,
          category_id = $6,
          is_active = $7,
          updated_at = NOW()

        WHERE id = $8

        RETURNING *
        `,
        [
          payload.name,
          payload.description,
          payload.price,
          payload.stockQuantity,
          payload.imageUrl || null,
          payload.categoryId,
          payload.isActive,
          req.params.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            'Producto no encontrado',
        });
      }

      return res.json({
        success: true,
        data: result.rows[0],
        message:
          'Producto actualizado',
      });

    } catch (error) {
      console.error(
        'Error al actualizar producto:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

app.delete(
  '/api/products/:id',
  requireApiAuth,
  async (req, res) => {

    try {
      const result = await query(
        `
        DELETE FROM products
        WHERE id = $1
        RETURNING id
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            'Producto no encontrado',
        });
      }

      return res.json({
        success: true,
        message:
          'Producto eliminado',
      });

    } catch (error) {
      console.error(
        'Error al eliminar producto:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

// ======================================================
// CATEGORÍAS
// ======================================================

app.get(
  '/api/categories',
  async (req, res) => {

    try {
      const result = await query(
        `
        SELECT *
        FROM categories
        ORDER BY name ASC
        `
      );

      return res.json({
        success: true,
        data: result.rows,
      });

    } catch (error) {
      console.error(
        'Error al obtener categorías:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

app.post(
  '/api/categories',
  requireApiAuth,
  async (req, res) => {

    const name =
      (
        req.body.name ||
        req.body.nombre ||
        ''
      ).trim();

    const description =
      req.body.description ||
      req.body.descripcion ||
      '';

    if (!name) {
      return res.status(400).json({
        success: false,
        message:
          'El nombre es requerido',
      });
    }

    try {
      const result = await query(
        `
        INSERT INTO categories
        (
          name,
          description
        )

        VALUES
        (
          $1,
          $2
        )

        RETURNING *
        `,
        [
          name,
          description,
        ]
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        message:
          'Categoría creada',
      });

    } catch (error) {

      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message:
            'La categoría ya existe',
        });
      }

      console.error(
        'Error al crear categoría:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

app.delete(
  '/api/categories/:id',
  requireApiAuth,
  async (req, res) => {

    try {
      const result = await query(
        `
        DELETE FROM categories
        WHERE id = $1
        RETURNING id
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            'Categoría no encontrada',
        });
      }

      return res.json({
        success: true,
        message:
          'Categoría eliminada',
      });

    } catch (error) {
      console.error(
        'Error al eliminar categoría:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

// ======================================================
// PEDIDOS
// ======================================================

app.post(
  '/api/orders',
  async (req, res) => {

    const customerName =
      (
        req.body.customer_name ||
        req.body.nombre_cliente ||
        ''
      ).trim();

    const customerPhone =
      req.body.customer_phone ||
      req.body.telefono_cliente ||
      '';

    const customerEmail =
      req.body.customer_email ||
      req.body.email_cliente ||
      '';

    const customerAddress =
      req.body.customer_address ||
      req.body.direccion_cliente ||
      '';

    const notes =
      req.body.notes ||
      req.body.notas ||
      '';

    const items =
      normalizeOrderItems(
        req.body.items || []
      );

    if (
      !customerName ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Datos incompletos para crear el pedido',
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      let totalAmount = 0;

      const validatedItems = [];

      for (const item of items) {

        const productResult =
          await client.query(
            `
            SELECT
              id,
              name,
              price,
              stock_quantity,
              is_active

            FROM products

            WHERE id = $1

            FOR UPDATE
            `,
            [item.productId]
          );

        if (
          productResult.rows.length === 0
        ) {
          throw new Error(
            `Producto ${item.productId} no encontrado`
          );
        }

        const product =
          productResult.rows[0];

        if (!product.is_active) {
          throw new Error(
            `El producto ${product.name} está inactivo`
          );
        }

        if (
          product.stock_quantity <
          item.quantity
        ) {
          throw new Error(
            `No hay suficiente stock disponible para ${product.name}`
          );
        }

        const unitPrice =
          Number(product.price);

        const subtotal =
          unitPrice *
          item.quantity;

        totalAmount += subtotal;

        validatedItems.push({
          productId:
            product.id,

          quantity:
            item.quantity,

          unitPrice,

          subtotal,

          itemNotes:
            item.itemNotes,

          itemSize:
            item.itemSize,
        });
      }

      const orderResult =
        await client.query(
          `
          INSERT INTO orders
          (
            customer_name,
            customer_phone,
            customer_email,
            customer_address,
            notes,
            status,
            total_amount
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            'pendiente',
            $6
          )

          RETURNING *
          `,
          [
            customerName,
            customerPhone,
            customerEmail,
            customerAddress,
            notes,
            totalAmount,
          ]
        );

      const order =
        orderResult.rows[0];

      for (
        const item
        of validatedItems
      ) {

        await client.query(
          `
          INSERT INTO order_items
          (
            order_id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            item_notes,
            item_size
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )
          `,
          [
            order.id,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.subtotal,
            item.itemNotes,
            item.itemSize,
          ]
        );

        await client.query(
          `
          UPDATE products

          SET
            stock_quantity =
              stock_quantity - $1,

            updated_at = NOW()

          WHERE id = $2
          `,
          [
            item.quantity,
            item.productId,
          ]
        );
      }

      await client.query(
        'COMMIT'
      );

      return res.status(201).json({
        success: true,

        data: {
          order_id:
            order.id,

          total_amount:
            totalAmount,

          status:
            order.status,
        },

        message:
          'Pedido reservado correctamente',
      });

    } catch (error) {

      await client.query(
        'ROLLBACK'
      );

      console.error(
        'Error al crear pedido:',
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          'No se pudo crear el pedido',
      });

    } finally {
      client.release();
    }
  }
);

// ======================================================
// LISTAR PEDIDOS
// ======================================================

app.get(
  '/api/orders',
  requireApiAuth,
  async (req, res) => {

    try {
      const result =
        await query(
          `
          SELECT
            o.*,
            COUNT(oi.id)::int AS item_count

          FROM orders o

          LEFT JOIN order_items oi
            ON oi.order_id = o.id

          GROUP BY o.id

          ORDER BY
            o.created_at DESC,
            o.id DESC
          `
        );

      return res.json({
        success: true,
        data: result.rows,
      });

    } catch (error) {
      console.error(
        'Error al obtener pedidos:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

// ======================================================
// CONSULTA PÚBLICA DE PEDIDO
// ======================================================

app.get(
  '/api/orders/public',
  async (req, res) => {

    const customerName =
      (req.query.name || '')
        .trim();

    const customerPhone =
      (req.query.phone || '')
        .trim();

    if (
      !customerName ||
      !customerPhone
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El nombre y el teléfono son requeridos',
      });
    }

    try {
      const orderResult =
        await query(
          `
          SELECT
            id,
            customer_name,
            customer_phone,
            customer_email,
            customer_address,
            notes,
            status,
            total_amount,
            created_at

          FROM orders

          WHERE
            LOWER(customer_name) =
              LOWER($1)

            AND customer_phone = $2

          ORDER BY
            created_at DESC,
            id DESC

          LIMIT 1
          `,
          [
            customerName,
            customerPhone,
          ]
        );

      if (
        orderResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Pedido no encontrado',
        });
      }

      return res.json({
        success: true,
        data:
          orderResult.rows[0],
      });

    } catch (error) {
      console.error(
        'Error al consultar estado público del pedido:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

// ======================================================
// DETALLE DE PEDIDO
// ======================================================

app.get(
  '/api/orders/:id',
  requireApiAuth,
  async (req, res) => {

    try {
      const orderResult =
        await query(
          `
          SELECT *
          FROM orders
          WHERE id = $1
          `,
          [req.params.id]
        );

      if (
        orderResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Pedido no encontrado',
        });
      }

      const order =
        orderResult.rows[0];

      const itemsResult =
        await query(
          `
          SELECT
            oi.*,
            p.name AS product_name,
            p.image_url AS product_image_url

          FROM order_items oi

          LEFT JOIN products p
            ON p.id = oi.product_id

          WHERE oi.order_id = $1

          ORDER BY oi.id ASC
          `,
          [req.params.id]
        );

      return res.json({
        success: true,

        data: {
          ...order,
          items:
            itemsResult.rows,
        },
      });

    } catch (error) {
      console.error(
        'Error al obtener detalle del pedido:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

// ======================================================
// ESTADO DEL PEDIDO
// ======================================================

app.put(
  '/api/orders/:id/status',
  requireApiAuth,
  async (req, res) => {

    const status =
      (
        req.body.status ||
        req.body.estado ||
        ''
      ).trim();

    const allowed = [
      'pendiente',
      'confirmado',
      'completado',
      'cancelado',
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          'Estado inválido',
      });
    }

    try {
      const result =
        await query(
          `
          UPDATE orders

          SET
            status = $1,
            updated_at = NOW()

          WHERE id = $2

          RETURNING *
          `,
          [
            status,
            req.params.id,
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Pedido no encontrado',
        });
      }

      return res.json({
        success: true,
        data: result.rows[0],
        message:
          'Estado actualizado',
      });

    } catch (error) {
      console.error(
        'Error al actualizar pedido:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

// ======================================================
// CLIENTES
// ======================================================

app.get(
  '/api/customers',
  requireApiAuth,
  async (req, res) => {

    try {
      const result =
        await query(
          `
          SELECT
            customer_name AS name,
            customer_phone AS phone,
            customer_email AS email,
            customer_address AS address,
            COUNT(*)::int AS orders_count,
            COALESCE(
              SUM(total_amount),
              0
            )::numeric(12,2) AS total_spent,
            MAX(created_at) AS last_order_at

          FROM orders

          GROUP BY
            customer_name,
            customer_phone,
            customer_email,
            customer_address

          ORDER BY
            last_order_at DESC,
            customer_name ASC
          `
        );

      return res.json({
        success: true,
        data: result.rows,
      });

    } catch (error) {
      console.error(
        'Error al obtener clientes:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

app.delete(
  '/api/customers/:name',
  requireApiAuth,
  async (req, res) => {

    try {
      const customerName =
        req.params.name;

      const customerPhone =
        (req.query.phone || '')
          .trim();

      const customerEmail =
        (req.query.email || '')
          .trim();

      const customerAddress =
        (req.query.address || '')
          .trim();

      let sql =
        `
        DELETE FROM orders
        WHERE customer_name = $1
        `;

      const params = [
        customerName,
      ];

      if (customerPhone) {
        params.push(
          customerPhone
        );

        sql +=
          ` AND customer_phone = $${params.length}`;
      }

      if (customerEmail) {
        params.push(
          customerEmail
        );

        sql +=
          ` AND customer_email = $${params.length}`;
      }

      if (customerAddress) {
        params.push(
          customerAddress
        );

        sql +=
          ` AND customer_address = $${params.length}`;
      }

      const result =
        await query(
          sql +
          ' RETURNING id',
          params
        );

      return res.json({
        success: true,

        message:
          'Cliente eliminado junto con sus pedidos',

        data: {
          deleted_orders:
            result.rows.length,
        },
      });

    } catch (error) {
      console.error(
        'Error al eliminar cliente:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

// ======================================================
// DASHBOARD
// ======================================================

app.get(
  '/api/dashboard',
  requireApiAuth,
  async (req, res) => {

    try {
      const [
        productsTotal,
        productsActive,
        productsLowStock,
        ordersTotal,
        ordersPending,
        revenue,
      ] = await Promise.all([

        query(
          `
          SELECT COUNT(*)::int AS total
          FROM products
          `
        ),

        query(
          `
          SELECT COUNT(*)::int AS total
          FROM products
          WHERE is_active = true
          `
        ),

        query(
          `
          SELECT COUNT(*)::int AS total
          FROM products
          WHERE
            stock_quantity > 0
            AND stock_quantity <= 3
          `
        ),

        query(
          `
          SELECT COUNT(*)::int AS total
          FROM orders
          `
        ),

        query(
          `
          SELECT COUNT(*)::int AS total
          FROM orders
          WHERE status = 'pendiente'
          `
        ),

        query(
          `
          SELECT
            COALESCE(
              SUM(total_amount),
              0
            )::numeric(12,2) AS total

          FROM orders
          `
        ),
      ]);

      return res.json({
        success: true,

        data: {
          products_total:
            productsTotal.rows[0].total,

          products_active:
            productsActive.rows[0].total,

          products_low_stock:
            productsLowStock.rows[0].total,

          orders_total:
            ordersTotal.rows[0].total,

          orders_pending:
            ordersPending.rows[0].total,

          total_revenue:
            Number(
              revenue.rows[0].total
            ),
        },
      });

    } catch (error) {
      console.error(
        'Error al obtener dashboard:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error en el servidor',
      });
    }
  }
);

// ======================================================
// CUENTA ADMINISTRADOR
// ======================================================

app.put(
  '/api/admin/account',
  requireApiAuth,
  async (req, res) => {

    const currentPassword =
      req.body.current_password ||
      req.body.contrasena_actual ||
      '';

    const newUsername =
      (
        req.body.new_username ||
        req.body.nuevo_usuario ||
        ''
      ).trim();

    const newPassword =
      req.body.new_password ||
      req.body.nueva_contrasena ||
      '';

    const confirmPassword =
      req.body.confirm_password ||
      req.body.confirmar_contrasena ||
      '';

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message:
          'La contraseña actual es requerida',
      });
    }

    if (
      !newUsername &&
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Debes indicar un nuevo usuario o una nueva contraseña',
      });
    }

    if (
      newPassword &&
      newPassword !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Las contraseñas no coinciden',
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const userResult =
        await client.query(
          `
          SELECT
            id,
            username,
            password

          FROM users

          WHERE id = $1
          `,
          [req.session.user.id]
        );

      if (
        userResult.rows.length === 0
      ) {
        throw new Error(
          'Usuario no encontrado'
        );
      }

      const user =
        userResult.rows[0];

      const matches =
        await bcrypt.compare(
          currentPassword,
          user.password
        );

      if (!matches) {
        throw new Error(
          'La contraseña actual es incorrecta'
        );
      }

      const nextUsername =
        newUsername ||
        user.username;

      const nextPassword =
        newPassword
          ? await bcrypt.hash(
              newPassword,
              10
            )
          : null;

      const updateResult =
        await client.query(
          `
          UPDATE users

          SET
            username = $1,
            password =
              COALESCE($2, password),
            updated_at = NOW()

          WHERE id = $3

          RETURNING
            id,
            username
          `,
          [
            nextUsername,
            nextPassword,
            user.id,
          ]
        );

      await client.query(
        'COMMIT'
      );

      req.session.user = {
        id:
          updateResult.rows[0].id,

        username:
          updateResult.rows[0].username,
      };

      return res.json({
        success: true,
        data:
          req.session.user,
        message:
          'Cuenta actualizada correctamente',
      });

    } catch (error) {

      await client.query(
        'ROLLBACK'
      );

      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message:
            'El usuario ya existe',
        });
      }

      console.error(
        'Error al actualizar cuenta:',
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          'No se pudo actualizar la cuenta',
      });

    } finally {
      client.release();
    }
  }
);

// ======================================================
// ARCHIVOS ESTÁTICOS
// ======================================================

app.use(
  express.static(publicDir)
);

// ======================================================
// MANEJO DE ERRORES
// ======================================================

app.use(
  (err, req, res, next) => {

    if (
      err instanceof multer.MulterError
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (err) {
      console.error(
        'Error inesperado:',
        err
      );

      return res.status(500).json({
        success: false,
        message:
          'Error interno del servidor',
      });
    }

    return next();
  }
);

// ======================================================
// SERVIDOR LOCAL / VERCEL
// ======================================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `🚀 Servidor Amaranta Accesorios corriendo en http://localhost:${PORT}`
    );
  });
}

module.exports = app;