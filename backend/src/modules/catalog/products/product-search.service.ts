import { Injectable } from '@nestjs/common';
import { escapeLike } from '../../../common/utils/slug.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

/** Máximo de coincidencias que se combinan con los demás filtros. */
const MAX_MATCHES = 5000;

/**
 * Búsqueda de productos por nombre, SKU, código de barras, marca o principio
 * activo, sin distinguir tildes ni mayúsculas ("acetaminofen" encuentra
 * "Acetaminofén"). Usa los índices de trigramas de la migración del catálogo.
 */
@Injectable()
export class ProductSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async matchingIds(text: string): Promise<string[]> {
    const term = text.trim();
    if (!term) return [];
    const pattern = `%${escapeLike(term)}%`;
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM products p
      WHERE p.deleted_at IS NULL AND (
        immutable_unaccent(p.name) LIKE immutable_unaccent(${pattern})
        OR lower(p.sku) LIKE lower(${pattern})
        OR p.barcode = ${term}
        OR EXISTS (
          SELECT 1 FROM brands b
          WHERE b.id = p.brand_id AND immutable_unaccent(b.name) LIKE immutable_unaccent(${pattern})
        )
        OR EXISTS (
          SELECT 1 FROM product_active_ingredients pai
          JOIN active_ingredients ai ON ai.id = pai.active_ingredient_id
          WHERE pai.product_id = p.id
            AND immutable_unaccent(ai.name) LIKE immutable_unaccent(${pattern})
        )
      )
      LIMIT ${MAX_MATCHES}`;
    return rows.map((r) => r.id);
  }
}
