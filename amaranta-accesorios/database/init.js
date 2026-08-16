require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || /sslmode=require/i.test(process.env.DATABASE_URL || '')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDatabase() {
  const client = await pool.connect();

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);

    await client.query('TRUNCATE TABLE order_items, orders, products, categories, users RESTART IDENTITY CASCADE');

    const categories = [
      ['Aretes', 'Aretes delicados y llamativos'],
      ['Collares', 'Collares y gargantillas'],
      ['Pulseras', 'Pulseras de estilo femenino'],
      ['Anillos', 'Anillos para cada ocasión'],
      ['Tobilleras', 'Tobilleras con detalles finos'],
      ['Sets', 'Sets coordinados de accesorios'],
      ['Accesorios para cabello', 'Diademas, pinzas y adornos'],
      ['Ofertas', 'Productos seleccionados en promoción'],
    ];

    for (const [name, description] of categories) {
      await client.query(
        'INSERT INTO categories (name, description) VALUES ($1, $2)',
        [name, description]
      );
    }

    const adminPassword = await bcrypt.hash('admin123', 10);
    await client.query(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      ['admin', adminPassword]
    );

    const products = [
      ['Aretes Aurora', 'Aretes elegantes con brillo celestial.', 85000, 15, 1, '/images/placeholder.svg'],
      ['Collar Celeste', 'Collar delicado inspirado en tonos cielo.', 120000, 8, 2, '/images/placeholder.svg'],
      ['Pulsera Amaranta', 'Pulsera femenina con acabado suave.', 95000, 12, 3, '/images/placeholder.svg'],
      ['Anillo Luna', 'Anillo de diseño minimalista y brillante.', 75000, 20, 4, '/images/placeholder.svg'],
      ['Set Elegance', 'Set coordinado para ocasiones especiales.', 150000, 5, 6, '/images/placeholder.svg'],
      ['Tobillera Sky', 'Tobillera sutil y elegante para complementar tu estilo.', 65000, 18, 5, '/images/placeholder.svg'],
      ['Aretes Brillo', 'Aretes con destellos para resaltar cualquier look.', 90000, 10, 1, '/images/placeholder.svg'],
      ['Collar Perla', 'Collar clásico con sensación atemporal.', 110000, 6, 2, '/images/placeholder.svg'],
    ];

    for (const [name, description, price, stockQuantity, categoryId, imageUrl] of products) {
      await client.query(
        `INSERT INTO products (name, description, price, stock_quantity, category_id, image_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [name, description, price, stockQuantity, categoryId, imageUrl]
      );
    }

    console.log('✅ Base de datos inicializada correctamente');
    console.log('✅ Usuario inicial: admin / admin123');
    console.log('✅ 8 categorías creadas');
    console.log('✅ 8 productos de ejemplo creados');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
