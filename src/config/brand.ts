/**
 * ── CONFIGURACIÓN DE MARCA ──────────────────────────────────────────────
 * Única fuente de verdad para todo texto de marca en la aplicación.
 *
 * Si el producto vuelve a cambiar de nombre, se edita SOLO este archivo.
 * Ningún componente, ruta, correo o metadata debe tener "Kolek" (o el
 * nombre que sea) escrito a mano — siempre se importa desde aquí:
 *
 *   import { brand } from '@/config/brand';
 *
 * Nota: esto cubre texto visible. Identificadores técnicos que YA viven en
 * sistemas externos (nombre de la tabla en Postgres, el paquete de npm, el
 * template de WhatsApp ya aprobado en Meta, claves de idempotencia viejas)
 * no se renombran solos con este archivo — cambiarlos requiere su propia
 * migración para no romper integraciones ya conectadas.
 */
export const brand = {
  /** Nombre corto de uso diario: UI, conversación, título de pestaña. */
  name: 'Kolek',
  /** Nombre a usar en contratos, facturas y textos legales. */
  legalProductName: 'Kolek',
  /** Empresa dueña del producto. */
  parentCompany: 'Ravela Group',
  /** Sitio de la empresa dueña (footer, nunca protagonista de la UI). */
  parentCompanyUrl: 'https://www.ravela.online/',
  /** Frase corta bajo el nombre — posicionamiento, no eslogan de venta. */
  tagline: 'Cobranza escolar preventiva',
  /** Variante alterna del tagline, para donde el espacio sea más corto. */
  taglineAlt: 'Cobra antes. Persigue menos.',
  /** Línea de posicionamiento negativo — qué NO es Kolek. */
  positioning: 'No reemplazamos tu sistema escolar. Arreglamos tu cobranza.',
  /** Texto exacto del pie de página en toda la app. */
  footerLine: 'A product by Ravela Group',
  /** Correo de contacto real — visible en /contacto, footer y páginas legales. */
  contactEmail: 'kolek@ravela.online',
  /** WhatsApp de contacto, formato legible para mostrar en pantalla. */
  contactPhoneDisplay: '+52 56 2534 6426',
  /** Mismo número en E.164 sin "+", para armar links wa.me / tel:. */
  contactPhoneE164: '525625346426',
} as const;

export type Brand = typeof brand;
