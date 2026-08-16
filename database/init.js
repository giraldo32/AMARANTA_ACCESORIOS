require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const databaseUrl =
  process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    '❌ ERROR: No existe DATABASE_URL en las variables de entorno.'
  );

  process.exit(1);
}

const isProduction =
  process.env.NODE_ENV === 'production' ||
  /sslmode=require/i.test(
    databaseUrl
  );

const pool = new Pool({
  connectionString:
    databaseUrl,

  ssl: isProduction
    ? {
        rejectUnauthorized: false,
      }
    : false,

  max: 5,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,
});

async function initDatabase() {
  const client =
    await pool.connect();

  try {
    console.log(
      '🔌 Conectando a PostgreSQL...'
    );

    const schemaPath =
      path.join(
        __dirname,
        'schema.sql'
      );

    if (!fs.existsSync(schemaPath)) {
      throw new Error(
        `No se encontró el archivo: ${schemaPath}`
      );
    }

    const schema =
      fs.readFileSync(
        schemaPath,
        'utf8'
      );

    console.log(
      '📋 Ejecutando schema.sql...'
    );

    await client.query(
      schema
    );

    // ==================================================
    // CATEGORÍAS
    // ==================================================

    const categories = [
      [
        'Aretes',
        'Aretes delicados y llamativos',
      ],

      [
        'Collares',
        'Collares y gargantillas',
      ],

      [
        'Pulseras',
        'Pulseras de estilo femenino',
      ],

      [
        'Anillos',
        'Anillos para cada ocasión',
      ],

      [
        'Tobilleras',
        'Tobilleras con detalles finos',
      ],

      [
        'Sets',
        'Sets coordinados de accesorios',
      ],

      [
        'Accesorios para cabello',
        'Diademas, pinzas y adornos',
      ],

      [
        'Ofertas',
        'Productos seleccionados en promoción',
      ],
    ];

    console.log(
      '📂 Creando categorías...'
    );

    for (
      const [
        name,
        description,
      ] of categories
    ) {
      await client.query(
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

        ON CONFLICT (name)
        DO NOTHING
        `,
        [
          name,
          description,
        ]
      );
    }

    // ==================================================
    // ADMINISTRADOR
    // ==================================================

    console.log(
      '👤 Verificando usuario administrador...'
    );

    const existingAdmin =
      await client.query(
        `
        SELECT id
        FROM users
        WHERE username = $1
        LIMIT 1
        `,
        ['admin']
      );

    if (
      existingAdmin.rows.length === 0
    ) {
      const adminPassword =
        await bcrypt.hash(
          'admin123',
          10
        );

      await client.query(
        `
        INSERT INTO users
        (
          username,
          password
        )

        VALUES
        (
          $1,
          $2
        )
        `,
        [
          'admin',
          adminPassword,
        ]
      );

      console.log(
        '✅ Usuario administrador creado: admin'
      );
    } else {
      console.log(
        'ℹ️ El usuario admin ya existe. No se modificó.'
      );
    }

    // ==================================================
    // PRODUCTOS
    // ==================================================

    const existingProducts =
      await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM products
        `
      );

    const productCount =
      existingProducts.rows[0].total;

    if (productCount === 0) {

      const products = [
        [
          'Aretes Aurora',
          'Aretes elegantes con brillo celestial.',
          85000,
          15,
          1,
          '/images/placeholder.svg',
        ],

        [
          'Collar Celeste',
          'Collar delicado inspirado en tonos cielo.',
          120000,
          8,
          2,
          '/images/placeholder.svg',
        ],

        [
          'Pulsera Amaranta',
          'Pulsera femenina con acabado suave.',
          95000,
          12,
          3,
          '/images/placeholder.svg',
        ],

        [
          'Anillo Luna',
          'Anillo de diseño minimalista y brillante.',
          75000,
          20,
          4,
          '/images/placeholder.svg',
        ],

        [
          'Set Elegance',
          'Set coordinado para ocasiones especiales.',
          150000,
          5,
          6,
          '/images/placeholder.svg',
        ],

        [
          'Tobillera Sky',
          'Tobillera sutil y elegante para complementar tu estilo.',
          65000,
          18,
          5,
          '/images/placeholder.svg',
        ],

        [
          'Aretes Brillo',
          'Aretes con destellos para resaltar cualquier look.',
          90000,
          10,
          1,
          '/images/placeholder.svg',
        ],

        [
          'Collar Perla',
          'Collar clásico con sensación atemporal.',
          110000,
          6,
          2,
          '/images/placeholder.svg',
        ],
      ];

      console.log(
        '🛍️ Creando productos de ejemplo...'
      );

      for (
        const [
          name,
          description,
          price,
          stockQuantity,
          categoryId,
          imageUrl,
        ] of products
      ) {

        await client.query(
          `
          INSERT INTO products
          (
            name,
            description,
            price,
            stock_quantity,
            category_id,
            image_url,
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
            true
          )
          `,
          [
            name,
            description,
            price,
            stockQuantity,
            categoryId,
            imageUrl,
          ]
        );
      }

      console.log(
        '✅ 8 productos creados.'
      );

    } else {

      console.log(
        `ℹ️ Ya existen ${productCount} productos. No se modificaron.`
      );
    }

    console.log('');
    console.log(
      '========================================'
    );
    console.log(
      '✅ BASE DE DATOS INICIALIZADA'
    );
    console.log(
      '========================================'
    );
    console.log(
      '👤 Usuario inicial: admin'
    );
    console.log(
      '🔑 Contraseña inicial: admin123'
    );
    console.log(
      '📂 Categorías verificadas.'
    );
    console.log(
      '🛍️ Productos verificados.'
    );
    console.log(
      '========================================'
    );

  } catch (error) {

    console.error(
      '❌ Error al inicializar la base de datos:'
    );

    console.error(
      error
    );

    process.exitCode = 1;

  } finally {

    client.release();

    await pool.end();
  }
}

initDatabase();