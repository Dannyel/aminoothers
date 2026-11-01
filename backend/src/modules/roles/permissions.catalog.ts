/**
 * Catálogo de permisos (`modulo.accion`). Es la fuente de verdad: el seed lo
 * sincroniza con la tabla `permissions`. Cada fase agrega los de sus módulos.
 */
export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_MANAGE: 'customers.manage',
  CATALOG_READ: 'catalog.read',
  CATALOG_MANAGE: 'catalog.manage',
  PRODUCTS_READ: 'products.read',
  PRODUCTS_MANAGE: 'products.manage',
  PRODUCTS_APPROVE_ONLINE_SALE: 'products.approve_online_sale',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_QUARANTINE: 'inventory.quarantine',
  INVENTORY_SETTINGS: 'inventory.settings',
  PURCHASES_READ: 'purchases.read',
  PURCHASES_MANAGE: 'purchases.manage',
  PURCHASES_APPROVE: 'purchases.approve',
  PURCHASES_RECEIVE: 'purchases.receive',
  SETTINGS_MANAGE: 'settings.manage',
  ORDERS_READ: 'orders.read',
  ORDERS_MANAGE: 'orders.manage',
  SHIPMENTS_MANAGE: 'shipments.manage',
  PAYMENTS_VERIFY: 'payments.verify',
  PAYMENTS_COLLECT: 'payments.collect',
  REFUNDS_MANAGE: 'refunds.manage',
  RETURNS_MANAGE: 'returns.manage',
  RETURNS_INSPECT: 'returns.inspect',
  BILLING_READ: 'billing.read',
  BILLING_MANAGE: 'billing.manage',
  PROMOTIONS_READ: 'promotions.read',
  PROMOTIONS_MANAGE: 'promotions.manage',
  REPORTS_READ: 'reports.read',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: ReadonlyArray<{
  code: PermissionCode;
  module: string;
  description: string;
}> = [
  {
    code: PERMISSIONS.USERS_READ,
    module: 'users',
    description: 'Consultar usuarios administrativos',
  },
  {
    code: PERMISSIONS.USERS_MANAGE,
    module: 'users',
    description:
      'Crear, editar, bloquear y asignar roles a usuarios administrativos',
  },
  {
    code: PERMISSIONS.ROLES_READ,
    module: 'roles',
    description: 'Consultar roles y permisos',
  },
  {
    code: PERMISSIONS.ROLES_MANAGE,
    module: 'roles',
    description: 'Crear, editar y eliminar roles',
  },
  {
    code: PERMISSIONS.CUSTOMERS_READ,
    module: 'customers',
    description: 'Consultar clientes y sus direcciones',
  },
  {
    code: PERMISSIONS.CUSTOMERS_MANAGE,
    module: 'customers',
    description: 'Bloquear, activar y desactivar clientes',
  },
  {
    code: PERMISSIONS.CATALOG_READ,
    module: 'catalog',
    description:
      'Consultar categorías, marcas, fabricantes, presentaciones, concentraciones, principios activos y etiquetas',
  },
  {
    code: PERMISSIONS.CATALOG_MANAGE,
    module: 'catalog',
    description: 'Crear, editar y dar de baja elementos de los catálogos',
  },
  {
    code: PERMISSIONS.PRODUCTS_READ,
    module: 'products',
    description: 'Consultar productos',
  },
  {
    code: PERMISSIONS.PRODUCTS_MANAGE,
    module: 'products',
    description: 'Crear y editar productos, precios e imágenes',
  },
  {
    code: PERMISSIONS.PRODUCTS_APPROVE_ONLINE_SALE,
    module: 'products',
    description:
      'Habilitar o deshabilitar la venta en línea de un producto (verificación regulatoria)',
  },
  {
    code: PERMISSIONS.INVENTORY_READ,
    module: 'inventory',
    description: 'Consultar existencias, lotes, vencimientos y movimientos',
  },
  {
    code: PERMISSIONS.INVENTORY_ADJUST,
    module: 'inventory',
    description:
      'Registrar existencias iniciales, ajustes y bajas de inventario',
  },
  {
    code: PERMISSIONS.INVENTORY_QUARANTINE,
    module: 'inventory',
    description:
      'Poner o liberar lotes de cuarentena, retiro del mercado o bloqueo',
  },
  {
    code: PERMISSIONS.INVENTORY_SETTINGS,
    module: 'inventory',
    description:
      'Configurar la vida útil mínima para vender y la alerta de vencimiento',
  },
  {
    code: PERMISSIONS.PURCHASES_READ,
    module: 'purchases',
    description: 'Consultar proveedores, órdenes de compra y recepciones',
  },
  {
    code: PERMISSIONS.PURCHASES_MANAGE,
    module: 'purchases',
    description: 'Gestionar proveedores y preparar órdenes de compra',
  },
  {
    code: PERMISSIONS.PURCHASES_APPROVE,
    module: 'purchases',
    description: 'Aprobar, cancelar y cerrar órdenes de compra',
  },
  {
    code: PERMISSIONS.PURCHASES_RECEIVE,
    module: 'purchases',
    description: 'Registrar recepciones de mercadería con sus lotes',
  },
  {
    code: PERMISSIONS.SETTINGS_MANAGE,
    module: 'settings',
    description:
      'Configurar los datos de la farmacia, los parámetros de pedidos, los métodos de envío, las mensajerías y las cuentas bancarias',
  },
  {
    code: PERMISSIONS.ORDERS_READ,
    module: 'orders',
    description: 'Consultar pedidos, pagos, envíos y devoluciones',
  },
  {
    code: PERMISSIONS.ORDERS_MANAGE,
    module: 'orders',
    description:
      'Confirmar pedidos contra entrega, pasarlos a preparación y cancelarlos',
  },
  {
    code: PERMISSIONS.SHIPMENTS_MANAGE,
    module: 'orders',
    description:
      'Despachar pedidos, registrar el seguimiento, la entrega o la devolución del paquete',
  },
  {
    code: PERMISSIONS.PAYMENTS_VERIFY,
    module: 'payments',
    description: 'Aprobar o rechazar transferencias bancarias',
  },
  {
    code: PERMISSIONS.PAYMENTS_COLLECT,
    module: 'payments',
    description: 'Registrar el cobro de pedidos contra entrega',
  },
  {
    code: PERMISSIONS.REFUNDS_MANAGE,
    module: 'payments',
    description: 'Registrar, completar y anular reembolsos',
  },
  {
    code: PERMISSIONS.RETURNS_MANAGE,
    module: 'returns',
    description: 'Registrar, aprobar, rechazar y recibir devoluciones',
  },
  {
    code: PERMISSIONS.RETURNS_INSPECT,
    module: 'returns',
    description:
      'Inspeccionar unidades devueltas y decidir si vuelven al inventario',
  },
  {
    code: PERMISSIONS.BILLING_READ,
    module: 'billing',
    description: 'Consultar comprobantes, datos FEL e ingresos',
  },
  {
    code: PERMISSIONS.BILLING_MANAGE,
    module: 'billing',
    description:
      'Configurar impuestos, registrar los datos de la FEL emitida y anular comprobantes',
  },
  {
    code: PERMISSIONS.PROMOTIONS_READ,
    module: 'promotions',
    description: 'Consultar promociones',
  },
  {
    code: PERMISSIONS.PROMOTIONS_MANAGE,
    module: 'promotions',
    description: 'Crear, editar y desactivar promociones',
  },
  {
    code: PERMISSIONS.REPORTS_READ,
    module: 'reports',
    description: 'Consultar los indicadores de ventas y los reportes',
  },
  {
    code: PERMISSIONS.NOTIFICATIONS_MANAGE,
    module: 'notifications',
    description:
      'Consultar la bandeja de correos enviados y reintentar los fallidos',
  },
  {
    code: PERMISSIONS.AUDIT_READ,
    module: 'audit',
    description: 'Consultar el registro de auditoría',
  },
];

/**
 * Roles de sistema y sus permisos iniciales. SUPER_ADMIN tiene todos los
 * permisos de forma implícita (no se guardan). Los demás pueden editarse desde
 * el panel; el seed solo les agrega permisos nuevos del catálogo, nunca les
 * devuelve los que un administrador haya quitado.
 */
export const SYSTEM_ROLES: ReadonlyArray<{
  code: string;
  name: string;
  description: string;
  permissions: PermissionCode[];
}> = [
  {
    code: 'SUPER_ADMIN',
    name: 'Superadministrador',
    description: 'Acceso total, incluida la gestión de roles y permisos',
    permissions: [],
  },
  {
    code: 'ADMIN',
    name: 'Administrador',
    description: 'Acceso total excepto la gestión de roles',
    permissions: [
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.CATALOG_READ,
      PERMISSIONS.CATALOG_MANAGE,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_MANAGE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.INVENTORY_QUARANTINE,
      PERMISSIONS.INVENTORY_SETTINGS,
      PERMISSIONS.PURCHASES_READ,
      PERMISSIONS.PURCHASES_MANAGE,
      PERMISSIONS.PURCHASES_APPROVE,
      PERMISSIONS.PURCHASES_RECEIVE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.SHIPMENTS_MANAGE,
      PERMISSIONS.PAYMENTS_VERIFY,
      PERMISSIONS.PAYMENTS_COLLECT,
      PERMISSIONS.REFUNDS_MANAGE,
      PERMISSIONS.RETURNS_MANAGE,
      PERMISSIONS.RETURNS_INSPECT,
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.BILLING_MANAGE,
      PERMISSIONS.PROMOTIONS_READ,
      PERMISSIONS.PROMOTIONS_MANAGE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.NOTIFICATIONS_MANAGE,
      PERMISSIONS.AUDIT_READ,
    ],
  },
  {
    code: 'PHARMACIST',
    name: 'Regente farmacéutico',
    description:
      'Catálogo sanitario, recetas, cuarentena de lotes e inspección de devoluciones',
    permissions: [
      PERMISSIONS.CATALOG_READ,
      PERMISSIONS.CATALOG_MANAGE,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_MANAGE,
      PERMISSIONS.PRODUCTS_APPROVE_ONLINE_SALE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_QUARANTINE,
      PERMISSIONS.PURCHASES_READ,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.RETURNS_INSPECT,
    ],
  },
  {
    code: 'WAREHOUSE',
    name: 'Bodega',
    description: 'Lotes, movimientos, recepciones, preparación y despacho',
    permissions: [
      PERMISSIONS.CATALOG_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.PURCHASES_READ,
      PERMISSIONS.PURCHASES_MANAGE,
      PERMISSIONS.PURCHASES_RECEIVE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.SHIPMENTS_MANAGE,
      PERMISSIONS.RETURNS_MANAGE,
    ],
  },
  {
    code: 'SALES',
    name: 'Ventas',
    description: 'Pedidos, envíos, confirmación contra entrega y clientes',
    permissions: [
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.SHIPMENTS_MANAGE,
      PERMISSIONS.PAYMENTS_COLLECT,
      PERMISSIONS.RETURNS_MANAGE,
      PERMISSIONS.PROMOTIONS_READ,
      PERMISSIONS.PROMOTIONS_MANAGE,
    ],
  },
  {
    code: 'FINANCE',
    name: 'Finanzas',
    description: 'Verificación de pagos, reembolsos, facturación y reportes',
    permissions: [
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.PURCHASES_READ,
      PERMISSIONS.PURCHASES_APPROVE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.PAYMENTS_VERIFY,
      PERMISSIONS.PAYMENTS_COLLECT,
      PERMISSIONS.REFUNDS_MANAGE,
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.BILLING_MANAGE,
      PERMISSIONS.PROMOTIONS_READ,
      PERMISSIONS.REPORTS_READ,
    ],
  },
];
