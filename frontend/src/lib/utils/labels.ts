import type {
	Availability,
	FelStatus,
	InvoiceStatus,
	PromotionState,
	PromotionType,
	LotStatus,
	Me,
	MovementType,
	NotificationStatus,
	NotificationType,
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
	PurchaseOrderStatus,
	RefundMethod,
	RefundStatus,
	ReturnDisposition,
	ReturnStatus,
	SaleCondition,
	ShipmentStatus,
	UserStatus
} from '#lib/api/types.ts';

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
	ACTIVE: 'Activo',
	BLOCKED: 'Bloqueado',
	INACTIVE: 'Inactivo'
};

export const USER_STATUS_TONES: Record<UserStatus, 'success' | 'danger' | 'neutral'> = {
	ACTIVE: 'success',
	BLOCKED: 'danger',
	INACTIVE: 'neutral'
};

export const PERMISSION_MODULE_LABELS: Record<string, string> = {
	users: 'Usuarios',
	roles: 'Roles y permisos',
	customers: 'Clientes',
	catalog: 'Catálogos',
	products: 'Productos',
	inventory: 'Inventario',
	purchases: 'Compras',
	settings: 'Configuración',
	orders: 'Pedidos y envíos',
	payments: 'Pagos y reembolsos',
	returns: 'Devoluciones',
	billing: 'Facturación',
	promotions: 'Promociones',
	reports: 'Reportes',
	notifications: 'Notificaciones',
	audit: 'Auditoría'
};

export const SALE_CONDITION_LABELS: Record<SaleCondition, string> = {
	OTC: 'Venta libre',
	PRESCRIPTION: 'Requiere receta',
	RETAINED_PRESCRIPTION: 'Receta retenida',
	CONTROLLED: 'Controlado'
};

/** Quetzales con dos decimales: "125.5" → "Q125.50". */
export function formatMoney(amount: string | number): string {
	return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(
		Number(amount)
	);
}

/** El backend ya resuelve los permisos efectivos (incluido el superadministrador). */
export function can(user: Me | null | undefined, permission: string): boolean {
	return user?.type === 'STAFF' && user.permissions.includes(permission);
}

export function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return '—';
	return new Intl.DateTimeFormat('es-GT', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Guatemala'
	}).format(new Date(iso));
}

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
	AVAILABLE: 'Disponible',
	QUARANTINE: 'Cuarentena',
	RECALLED: 'Retirado del mercado',
	BLOCKED: 'Bloqueado'
};

export const LOT_STATUS_TONES: Record<LotStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
	AVAILABLE: 'success',
	QUARANTINE: 'warning',
	RECALLED: 'danger',
	BLOCKED: 'neutral'
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
	PURCHASE_RECEIPT: 'Recepción de compra',
	SALE: 'Venta',
	ADJUSTMENT_IN: 'Ajuste de entrada',
	ADJUSTMENT_OUT: 'Ajuste de salida',
	RETURN_RESTOCK: 'Devolución reintegrada',
	WRITE_OFF: 'Baja',
	RETURN_TO_SUPPLIER: 'Devolución a proveedor'
};

export const REASON_LABELS: Record<string, string> = {
	INITIAL_STOCK: 'Existencia inicial',
	COUNT_CORRECTION: 'Corrección por conteo',
	ENTRY_ERROR: 'Error de registro',
	FOUND: 'Hallazgo',
	LOSS: 'Pérdida',
	EXPIRED: 'Vencido',
	DAMAGED: 'Dañado',
	RECALL: 'Retiro del mercado',
	RETURN_TO_SUPPLIER: 'Devolución al proveedor',
	OTHER: 'Otro'
};

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
	DRAFT: 'Borrador',
	APPROVED: 'Aprobada',
	PARTIALLY_RECEIVED: 'Recibida parcialmente',
	RECEIVED: 'Recibida',
	CLOSED: 'Cerrada con faltante',
	CANCELLED: 'Cancelada'
};

export const PURCHASE_ORDER_STATUS_TONES: Record<
	PurchaseOrderStatus,
	'neutral' | 'info' | 'warning' | 'success' | 'danger'
> = {
	DRAFT: 'neutral',
	APPROVED: 'info',
	PARTIALLY_RECEIVED: 'warning',
	RECEIVED: 'success',
	CLOSED: 'neutral',
	CANCELLED: 'danger'
};

/** "2027-03-01" → "1 mar 2027" (fechas sin hora: no se convierten de zona). */
export function formatDate(date: string | null | undefined): string {
	if (!date) return '—';
	return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeZone: 'UTC' }).format(
		new Date(`${date}T00:00:00Z`)
	);
}

export function formatOrderNumber(prefix: string, number: number): string {
	return `${prefix}-${String(number).padStart(6, '0')}`;
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const AVAILABILITY_LABELS: Record<Availability, string> = {
	AVAILABLE: 'Disponible',
	LOW_STOCK: 'Últimas unidades',
	OUT_OF_STOCK: 'Agotado',
	PHARMACY_ONLY: 'Venta solo en farmacia',
	NOT_FOR_SALE: 'No disponible en línea'
};

export const AVAILABILITY_TONES: Record<Availability, Tone> = {
	AVAILABLE: 'success',
	LOW_STOCK: 'warning',
	OUT_OF_STOCK: 'neutral',
	PHARMACY_ONLY: 'info',
	NOT_FOR_SALE: 'neutral'
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	PENDING_PAYMENT: 'Pendiente de pago',
	PAYMENT_IN_REVIEW: 'Pago en revisión',
	PENDING_CONFIRMATION: 'Pendiente de confirmación',
	CONFIRMED: 'Confirmado',
	PREPARING: 'En preparación',
	SHIPPED: 'Enviado',
	DELIVERED: 'Entregado',
	DELIVERY_FAILED: 'Entrega fallida',
	RETURNED_TO_STORE: 'Devuelto a la farmacia',
	CANCELLED: 'Cancelado',
	EXPIRED: 'Vencido'
};

export const ORDER_STATUS_TONES: Record<OrderStatus, Tone> = {
	PENDING_PAYMENT: 'warning',
	PAYMENT_IN_REVIEW: 'info',
	PENDING_CONFIRMATION: 'warning',
	CONFIRMED: 'info',
	PREPARING: 'info',
	SHIPPED: 'info',
	DELIVERED: 'success',
	DELIVERY_FAILED: 'danger',
	RETURNED_TO_STORE: 'danger',
	CANCELLED: 'neutral',
	EXPIRED: 'neutral'
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	BANK_TRANSFER: 'Transferencia bancaria',
	CASH_ON_DELIVERY: 'Efectivo contra entrega'
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
	PENDING: 'Pendiente',
	IN_REVIEW: 'En verificación',
	APPROVED: 'Aprobado',
	REJECTED: 'Rechazado',
	CANCELLED: 'Cancelado',
	REFUNDED: 'Reembolsado',
	PARTIALLY_REFUNDED: 'Reembolsado parcialmente'
};

/** Plazo de entrega de un método de envío: "1 a 2 días hábiles". */
export function deliveryEstimate(min: number | null, max: number | null): string | null {
	if (min === null && max === null) return null;
	if (min !== null && max !== null && min !== max) return `${min} a ${max} días hábiles`;
	const days = max ?? min;
	return days === 0 ? 'El mismo día' : `${days} día(s) hábil(es)`;
}

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, Tone> = {
	PENDING: 'warning',
	IN_REVIEW: 'info',
	APPROVED: 'success',
	REJECTED: 'danger',
	CANCELLED: 'neutral',
	REFUNDED: 'neutral',
	PARTIALLY_REFUNDED: 'warning'
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
	DISPATCHED: 'Despachado',
	IN_TRANSIT: 'En tránsito',
	DELIVERED: 'Entregado',
	FAILED: 'Entrega fallida',
	RETURNED: 'Devuelto a la farmacia'
};

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
	REQUESTED: 'Registrada',
	APPROVED: 'Aprobada',
	REJECTED: 'Rechazada',
	RECEIVED: 'Recibida, por inspeccionar',
	CLOSED: 'Cerrada'
};

export const RETURN_STATUS_TONES: Record<ReturnStatus, Tone> = {
	REQUESTED: 'warning',
	APPROVED: 'info',
	REJECTED: 'neutral',
	RECEIVED: 'warning',
	CLOSED: 'success'
};

export const DISPOSITION_LABELS: Record<ReturnDisposition, string> = {
	PENDING_INSPECTION: 'Pendiente de inspección',
	RESTOCK: 'Reincorporado al inventario',
	DESTROY: 'Destruido',
	RETURN_TO_SUPPLIER: 'Devolver al proveedor'
};

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
	BANK_TRANSFER: 'Transferencia',
	CASH: 'Efectivo'
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
	PENDING: 'Pendiente',
	COMPLETED: 'Completado',
	CANCELLED: 'Anulado'
};

export const REFUND_STATUS_TONES: Record<RefundStatus, Tone> = {
	PENDING: 'warning',
	COMPLETED: 'success',
	CANCELLED: 'neutral'
};

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
	PERCENTAGE: 'Porcentaje',
	FIXED_AMOUNT: 'Monto fijo'
};

export const PROMOTION_STATE_LABELS: Record<PromotionState, string> = {
	ACTIVE: 'Vigente',
	SCHEDULED: 'Programada',
	EXPIRED: 'Finalizada',
	INACTIVE: 'Inactiva'
};

export const PROMOTION_STATE_TONES: Record<PromotionState, Tone> = {
	ACTIVE: 'success',
	SCHEDULED: 'info',
	EXPIRED: 'neutral',
	INACTIVE: 'neutral'
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
	ISSUED: 'Emitido',
	VOIDED: 'Anulado'
};

export const FEL_STATUS_LABELS: Record<FelStatus, string> = {
	PENDING: 'FEL pendiente de registrar',
	CERTIFIED: 'FEL registrada',
	NOT_APPLICABLE: 'No aplica'
};

export const FEL_STATUS_TONES: Record<FelStatus, Tone> = {
	PENDING: 'warning',
	CERTIFIED: 'success',
	NOT_APPLICABLE: 'neutral'
};

/** Valor de una promoción para mostrar: "15 %" o "Q5.00". */
export function promotionValue(type: PromotionType, value: string): string {
	return type === 'PERCENTAGE' ? `${Number(value)} %` : formatMoney(value);
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
	ORDER_PLACED: 'Pedido recibido',
	ORDER_STATUS_CHANGED: 'Cambio de estado del pedido',
	STAFF_TRANSFER_TO_VERIFY: 'Comprobante por verificar (personal)',
	STAFF_INVENTORY_DIGEST: 'Alertas de inventario (personal)'
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
	PENDING: 'Pendiente',
	SENT: 'Enviado',
	FAILED: 'Fallido'
};

export const NOTIFICATION_STATUS_TONES: Record<NotificationStatus, Tone> = {
	PENDING: 'info',
	SENT: 'success',
	FAILED: 'danger'
};

/** Módulos del registro de auditoría (primer segmento de la ruta del panel). */
export const AUDIT_MODULE_LABELS: Record<string, string> = {
	auth: 'Inicio de sesión',
	users: 'Usuarios',
	roles: 'Roles y permisos',
	customers: 'Clientes',
	catalog: 'Catálogos',
	categories: 'Categorías',
	subcategories: 'Subcategorías',
	products: 'Productos',
	inventory: 'Inventario',
	suppliers: 'Proveedores',
	'purchase-orders': 'Órdenes de compra',
	settings: 'Configuración',
	'shipping-methods': 'Métodos de envío',
	couriers: 'Mensajerías',
	'bank-accounts': 'Cuentas bancarias',
	orders: 'Pedidos',
	payments: 'Pagos',
	refunds: 'Reembolsos',
	returns: 'Devoluciones',
	billing: 'Facturación',
	promotions: 'Promociones',
	notifications: 'Notificaciones'
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
	LOGIN: 'Inicio de sesión',
	LOGIN_FAILED: 'Inicio de sesión fallido',
	ACCOUNT_LOCKED: 'Cuenta bloqueada por intentos fallidos',
	create: 'Crear',
	update: 'Editar',
	remove: 'Eliminar',
	proof: 'Ver comprobante de pago'
};

export const auditModuleLabel = (module: string) => AUDIT_MODULE_LABELS[module] ?? module;
export const auditActionLabel = (action: string) => AUDIT_ACTION_LABELS[action] ?? action;
