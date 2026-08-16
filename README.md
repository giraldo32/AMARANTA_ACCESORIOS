# AMARANTA ACCESORIOS
Sistema de catálogo de productos con carrito de compras y panel de administración

## 📋 Requisitos del Sistema
- Node.js (v16 o superior)
- PostgreSQL (v12 o superior)
- npm (incluido con Node.js)

## 🚀 Pasos para Ejecutar el Proyecto

### 1. Crear la Base de Datos
Abre pgAdmin o psql y ejecuta:

```sql
CREATE DATABASE amaranta_accesorios;
```

**Nota:** La conexión por defecto usa:
- Usuario: postgres
- Contraseña: admin
- Host: localhost:5432

Si tus credenciales son diferentes, edita el archivo `server/db.js` con tus datos.

### 2. Instalar Dependencias
Abre una terminal en la carpeta del proyecto:

```bash
cd c:\Users\Usuario\Desktop\amaranta-accesorios
npm install
```

### 3. Inicializar la Base de Datos
Este comando crea todas las tablas, el usuario administrador, categorías y productos de ejemplo:

```bash
npm run init-db
```

Lo que crea:
- ✅ 5 tablas: users, products, orders, order_items, categories
- ✅ Usuario admin: admin/admin123
- ✅ 8 categorías de productos
- ✅ 8 productos de ejemplo

### 4. Iniciar el Servidor
```bash
npm start
```

El servidor se iniciará en: http://localhost:3000

## 🌐 URLs del Sistema

| Página | URL | Descripción |
|--------|-----|-------------|
| Catálogo Público | http://localhost:3000 | Vista para clientes |
| Iniciar sesión como administrador | http://localhost:3000/admin/login.html | Acceso al panel |
| Panel de administración | http://localhost:3000/admin/dashboard.html | Gestión del sistema |

## 🔐 Credenciales de Administrador

| Campo | Valor |
|-------|-------|
| Usuario | admin |
| Contraseña | admin123 |

## 📖 Funcionalidades

### 👥 Para Clientes (Público)

| Funcionalidad | Descripción |
|--------------|-------------|
| Catálogo visual | Productos en tarjetas con imagen, nombre, precio y stock |
| Filtro por categorías | Botones para filtrar productos |
| Buscador | Búsqueda por nombre o descripción |
| Vista detalle | Modal con información completa del producto |
| Carrito de compras | Agregar/quitar productos, ajustar cantidades |
| Separar pedido | Formulario para reservar productos (nombre, teléfono, correo electrónico, notas) |
| WhatsApp | Botón flotante para contacto directo |
| Diseño responsive | Adaptable a celular, tablet y escritorio |

### 🔧 Para Administrador

| Funcionalidad | Descripción |
|--------------|-------------|
| Panel | Estadísticas: productos, pedidos, ingresos, stock bajo |
| Productos | CRUD completo: crear, editar, activar/desactivar, eliminar |
| Pedidos | Ver todos los pedidos, cambiar estados (pendiente → confirmado → completado → cancelado) |
| Categorías | Crear y eliminar categorías |
| Autenticación | Login protegido con sesiones |

## 🗄️ Estructura de la Base de Datos

### Tablas

| Tabla | Descripción |
|-------|-------------|
| users | Administradores del sistema |
| products | Productos del catálogo |
| categories | Categorías para organizar productos |
| orders | Pedidos realizados por clientes |
| order_items | Productos dentro de cada pedido |

### Diagrama de relaciones

```
users (1) ──── (N) No hay relación directa

categories (1) ──── (N) products

orders (1) ──── (N) order_items (N) ──── (1) products
```

## 📁 Estructura del Proyecto

```
amaranta-accesorios/
├── database/
│   ├── schema.sql             # Script SQL manual para crear la BD
│   └── init.js                # Inicializador automático con datos de ejemplo
│
├── server/
│   ├── db.js                  # Configuración de conexión a PostgreSQL
│   └── server.js              # Servidor Express con todas las APIs
│
├── public/
│   ├── index.html             # Catálogo público para clientes
│   ├── css/
│   │   └── style.css          # Estilos profesionales responsive
│   ├── js/
│   │   └── main.js            # Lógica del carrito y pedidos
│   └── admin/
│       ├── login.html         # Página de inicio de sesión
│       ├── dashboard.html     # Panel de administración
│       └── admin.js           # CRUD productos, pedidos, categorías
│
├── package.json               # Dependencias y scripts
├── package-lock.json          # Lock de dependencias
├── .env                       # Variables de entorno
├── .env.example               # Ejemplo de variables de entorno
└── README.md                  # Este archivo
```

## 🛠️ Tecnologías Utilizadas

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Node.js | Mayores de 16 años | Entorno de ejecución |
| Express | 4.18+ | Marco web |
| PostgreSQL | 12+ | Base de datos |
| pg | 8.11+ | Cliente PostgreSQL para Node.js |
| bcryptjs | 2.4+ | Encriptación de contraseñas |
| express-session | 1.17+ | Manejo de sesiones |
| dotenv | 16.3+ | Variables de entorno |
| Bootstrap 5 | 5.3+ | Marco CSS responsivo |
| Tailwind CSS | 2.2+ | Utilidades CSS adicionales |
| Bootstrap Icons | 1.11+ | Iconografía |

## 📡 Puntos finales de la API

### Autenticación

| Método | Punto final | Descripción |
|--------|-------------|-------------|
| POST | /api/login | Iniciar sesión |
| GET | /api/logout | Cerrar sesión |
| GET | /api/session | Verificar sesión activa |

### Productos

| Método | Punto final | Descripción |
|--------|-------------|-------------|
| GET | /api/products | Listar productos (consulta: category, search, include_inactive) |
| GET | /api/products/:id | Obtener producto por ID |
| POST | /api/products | Crear producto (requiere autenticación) |
| PUT | /api/products/:id | Actualizar producto (requiere autenticación) |
| DELETE | /api/products/:id | Eliminar producto (requiere autenticación) |

### Pedidos

| Método | Punto final | Descripción |
|--------|-------------|-------------|
| POST | /api/orders | Crear pedido (público) |
| GET | /api/orders | Listar pedidos (requiere autenticación) |
| PUT | /api/orders/:id/status | Actualizar estado (requiere autenticación) |

### Categorías

| Método | Punto final | Descripción |
|--------|-------------|-------------|
| GET | /api/categories | Listar categorías |
| POST | /api/categories | Crear categoría (requiere autenticación) |
| DELETE | /api/categories/:id | Eliminar categoría (requiere autenticación) |

### Panel

| Método | Punto final | Descripción |
|--------|-------------|-------------|
| GET | /api/dashboard | Estadísticas del sistema (requiere autenticación) |

### Cuenta

| Método | Punto final | Descripción |
|--------|-------------|-------------|
| PUT | /api/admin/account | Cambiar usuario/contraseña (requiere autenticación) |

### Clientes

| Método | Punto final | Descripción |
|--------|-------------|-------------|
| GET | /api/customers | Listar clientes |
| DELETE | /api/customers/:name | Eliminar cliente |

## 🎨 Personalización

### Colores
Los colores principales se pueden modificar en `public/css/style.css`:

- Fondo oscuro: #1a1a2e, #16213e, #0f3460
- Acento principal: #ffc107 (amarillo)
- Colores de estado: éxito, peligro, información, advertencia

### WhatsApp
Para cambiar el número de WhatsApp, edite en `public/index.html`:

```html
<a href="https://wa.me/57XXXXXXXXXX?text=...">
  Reemplaza 57XXXXXXXXXX con tu número en formato internacional.
```

### Productos de ejemplo
Los productos de ejemplo se agregan en `database/init.js`. Puedes editarlos o eliminarlos antes de ejecutar `npm run init-db`.

## 🔒 Seguridad

- Las contraseñas se almacenan encriptadas con bcryptjs
- Las sesiones se manejan con express-session
- El panel admin requiere autenticación para todas las operaciones CRUD
- Los pedidos de clientes no requieren autenticación
- Validación de stock antes de confirmar pedidos

## 📱 Diseño Responsive

El sistema está optimizado para:

- **Celulares (320px+)** - 2 columnas de productos
- **Tablets (768px+)** - 3 columnas de productos
- **Escritorio (992px+)** - 4 columnas de productos
- **Pantallas grandes (1200px+)** - 4+ columnas

## ❓ Solución de Problemas

| Error | Solución |
|-------|----------|
| ECONNREFUSED ::1:5432 | PostgreSQL no está corriendo. Iniciar el servicio: Windows: `net start postgresql-x64-XX` |
| database "mtn_fashion" does not exist | Crea la base de datos primero: `CREATE DATABASE mtn_fashion;` |
| password authentication failed | Verifica las credenciales en `server/db.js` y ajusta usuario/contraseña según tu configuración de PostgreSQL. |
| Puerto 3000 en uso | Cambia el puerto en `server/server.js`: `const PORT = 3001;` |

## 📄 Licencia

Proyecto desarrollado para AMARANTA ACCESORIOS. Todos los derechos reservados.

## ✨ Créditos

Desarrollado con ❤️ para AMARANTA ACCESORIOS.

"Accesorios que realzan tu estilo, calidad, tendencia y amor en cada detalle."..