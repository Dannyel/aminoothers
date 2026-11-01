/**
 * Menú del panel. Cada fase agrega las secciones que implementa; solo se
 * muestran las secciones para las que el usuario tiene permiso.
 */
import { resolve } from '$app/paths';

export interface MenuItem {
	/** Enlace ya resuelto con resolve(). */
	href: string;
	/** Prefijo de la URL que marca la sección como activa. */
	match: string;
	label: string;
	/** Permiso necesario para ver la sección (null = cualquier usuario del personal). */
	permission: string | null;
}

export const ADMIN_MENU: ReadonlyArray<{ title: string; items: MenuItem[] }> = [
	{
		title: 'General',
		items: [
			{ href: resolve('admin'), match: '/admin', label: 'Dashboard', permission: null },
			{
				href: resolve('admin/reportes'),
				match: '/admin/reportes',
				label: 'Reportes',
				permission: 'reports.read'
			}
		]
	},
	{
		title: 'Catálogo',
		items: [
			{
				href: resolve('admin/productos'),
				match: '/admin/productos',
				label: 'Productos',
				permission: 'products.read'
			},
			{
				href: resolve('admin/categorias'),
				match: '/admin/categorias',
				label: 'Categorías',
				permission: 'catalog.read'
			},
			{
				href: resolve('admin/catalogos/marcas'),
				match: '/admin/catalogos/marcas',
				label: 'Marcas',
				permission: 'catalog.read'
			},
			{
				href: resolve('admin/catalogos/fabricantes'),
				match: '/admin/catalogos/fabricantes',
				label: 'Fabricantes',
				permission: 'catalog.read'
			},
			{
				href: resolve('admin/catalogos/presentaciones'),
				match: '/admin/catalogos/presentaciones',
				label: 'Presentaciones',
				permission: 'catalog.read'
			},
			{
				href: resolve('admin/catalogos/concentraciones'),
				match: '/admin/catalogos/concentraciones',
				label: 'Concentraciones',
				permission: 'catalog.read'
			},
			{
				href: resolve('admin/catalogos/principios-activos'),
				match: '/admin/catalogos/principios-activos',
				label: 'Principios activos',
				permission: 'catalog.read'
			},
			{
				href: resolve('admin/catalogos/etiquetas'),
				match: '/admin/catalogos/etiquetas',
				label: 'Etiquetas',
				permission: 'catalog.read'
			}
		]
	},
	{
		title: 'Ventas',
		items: [
			{
				href: resolve('admin/pedidos'),
				match: '/admin/pedidos',
				label: 'Pedidos',
				permission: 'orders.read'
			},
			{
				href: resolve('admin/pagos'),
				match: '/admin/pagos',
				label: 'Pagos por verificar',
				permission: 'orders.read'
			},
			{
				href: resolve('admin/devoluciones'),
				match: '/admin/devoluciones',
				label: 'Devoluciones',
				permission: 'orders.read'
			},
			{
				href: resolve('admin/reembolsos'),
				match: '/admin/reembolsos',
				label: 'Reembolsos',
				permission: 'orders.read'
			},
			{
				href: resolve('admin/promociones'),
				match: '/admin/promociones',
				label: 'Promociones',
				permission: 'promotions.read'
			}
		]
	},
	{
		title: 'Facturación',
		items: [
			{
				href: resolve('admin/facturacion'),
				match: '/admin/facturacion',
				label: 'Comprobantes y FEL',
				permission: 'billing.read'
			},
			{
				href: resolve('admin/ingresos'),
				match: '/admin/ingresos',
				label: 'Ingresos',
				permission: 'billing.read'
			},
			{
				href: resolve('admin/impuestos'),
				match: '/admin/impuestos',
				label: 'Impuestos',
				permission: 'billing.read'
			}
		]
	},
	{
		title: 'Inventario',
		items: [
			{
				href: resolve('admin/inventario'),
				match: '/admin/inventario',
				label: 'Existencias',
				permission: 'inventory.read'
			},
			{
				href: resolve('admin/lotes'),
				match: '/admin/lotes',
				label: 'Lotes y vencimientos',
				permission: 'inventory.read'
			},
			{
				href: resolve('admin/movimientos'),
				match: '/admin/movimientos',
				label: 'Movimientos',
				permission: 'inventory.read'
			}
		]
	},
	{
		title: 'Compras',
		items: [
			{
				href: resolve('admin/compras'),
				match: '/admin/compras',
				label: 'Órdenes de compra',
				permission: 'purchases.read'
			},
			{
				href: resolve('admin/proveedores'),
				match: '/admin/proveedores',
				label: 'Proveedores',
				permission: 'purchases.read'
			}
		]
	},
	{
		title: 'Clientes',
		items: [
			{
				href: resolve('admin/clientes'),
				match: '/admin/clientes',
				label: 'Clientes',
				permission: 'customers.read'
			}
		]
	},
	{
		title: 'Configuración',
		items: [
			{
				href: resolve('admin/configuracion'),
				match: '/admin/configuracion',
				label: 'Farmacia',
				permission: 'settings.manage'
			},
			{
				href: resolve('admin/metodos-envio'),
				match: '/admin/metodos-envio',
				label: 'Métodos de envío',
				permission: 'settings.manage'
			},
			{
				href: resolve('admin/mensajerias'),
				match: '/admin/mensajerias',
				label: 'Mensajerías',
				permission: 'settings.manage'
			},
			{
				href: resolve('admin/cuentas-bancarias'),
				match: '/admin/cuentas-bancarias',
				label: 'Cuentas bancarias',
				permission: 'settings.manage'
			},
			{
				href: resolve('admin/notificaciones'),
				match: '/admin/notificaciones',
				label: 'Correos enviados',
				permission: 'notifications.manage'
			}
		]
	},
	{
		title: 'Seguridad',
		items: [
			{
				href: resolve('admin/usuarios'),
				match: '/admin/usuarios',
				label: 'Usuarios',
				permission: 'users.read'
			},
			{
				href: resolve('admin/roles'),
				match: '/admin/roles',
				label: 'Roles y permisos',
				permission: 'roles.read'
			},
			{
				href: resolve('admin/auditoria'),
				match: '/admin/auditoria',
				label: 'Auditoría',
				permission: 'audit.read'
			}
		]
	}
];
