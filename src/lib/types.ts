export type SchoolNivel =
  | 'kinder'
  | 'primaria'
  | 'secundaria'
  | 'prepa'
  | 'universidad'
  | 'academia'
  | 'otro';

export type SchoolPlan = 'inicio' | 'crecimiento' | 'pro';
export type StudentStatus = 'activo' | 'baja' | 'egresado';
export type PaymentStatus = 'pendiente' | 'pagado' | 'atrasado';
export type WaLogStatus = 'en_cola' | 'enviado' | 'fallado';
export type MemberRole = 'owner' | 'admin' | 'staff';

export interface School {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  nivel: SchoolNivel;
  whatsapp: string | null;
  plan: SchoolPlan;
  rfc: string | null;
  mp_access_token: string | null;
  mp_public_key: string | null;
  whatsapp_token: string | null;
  whatsapp_phone_number_id: string | null;
  dia_vencimiento: number;
  recordatorios_dias: number[];
  onboarding_completo: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  school_id: string | null;
  nombre: string | null;
  email: string | null;
  role: MemberRole;
  /** Acceso al panel interno de Kolek (/superadmin) — se activa a mano en la base de datos. */
  is_superadmin: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  school_id: string;
  nombre: string;
  nivel_educativo: string | null;
  monto_default: number;
  orden: number;
  created_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  group_id: string | null;
  nombre_alumno: string;
  nombre_tutor: string;
  whatsapp_tutor: string;
  email_tutor: string | null;
  monto_custom: number | null;
  matricula: string | null;
  notas: string | null;
  status: StudentStatus;
  created_at: string;
}

export interface Concept {
  id: string;
  school_id: string;
  nombre: string;
  es_recurrente: boolean;
  monto_fijo: number | null;
  created_at: string;
}

export interface Payment {
  id: string;
  school_id: string;
  student_id: string;
  concept_id: string;
  ciclo: string;
  monto_concepto: number;
  monto_total_cobrado: number;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  mp_init_point: string | null;
  mp_status: string | null;
  status: PaymentStatus;
  fecha_pago: string | null;
  fecha_vencimiento: string;
  link_token: string;
  metodo_pago: string | null;
  nota_manual: string | null;
  created_at: string;
}

export interface WhatsappLog {
  id: string;
  school_id: string;
  payment_id: string | null;
  to: string;
  message: string;
  wa_message_id: string | null;
  status: WaLogStatus;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

/** Fila desnormalizada de la vista v_payment_rows — lo que come la tabla. */
export interface PaymentRow {
  id: string;
  school_id: string;
  ciclo: string;
  status: PaymentStatus;
  monto_concepto: number;
  monto_total_cobrado: number;
  fecha_vencimiento: string;
  fecha_pago: string | null;
  link_token: string;
  mp_status: string | null;
  mp_payment_id: string | null;
  metodo_pago: string | null;
  student_id: string;
  nombre_alumno: string;
  nombre_tutor: string;
  whatsapp_tutor: string;
  email_tutor: string | null;
  student_status: StudentStatus;
  group_id: string | null;
  group_nombre: string;
  concept_id: string;
  concept_nombre: string;
}

export const NIVELES: { value: SchoolNivel; label: string; ejemplo: string }[] = [
  { value: 'kinder', label: 'Estancia infantil / Kínder', ejemplo: 'Maternal, Preescolar 1-3' },
  { value: 'primaria', label: 'Primaria', ejemplo: '1ro A, 2do B…' },
  { value: 'secundaria', label: 'Secundaria', ejemplo: '1ro, 2do, 3ro' },
  { value: 'prepa', label: 'Preparatoria / Bachillerato', ejemplo: 'Semestres' },
  { value: 'universidad', label: 'Universidad', ejemplo: 'Carreras y cuatrimestres' },
  { value: 'academia', label: 'Academia o curso', ejemplo: 'Inglés, karate, música, natación' },
  { value: 'otro', label: 'Otro', ejemplo: 'Lo configuras a tu manera' },
];

export const NIVEL_LABEL: Record<SchoolNivel, string> = {
  kinder: 'Kínder',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  prepa: 'Preparatoria',
  universidad: 'Universidad',
  academia: 'Academia',
  otro: 'Otro',
};

/**
 * Sugerencias de grupos SOLO como atajo de onboarding.
 * El usuario puede borrarlas todas y escribir las suyas. Nada es obligatorio.
 */
export const SUGERENCIAS_GRUPOS: Record<SchoolNivel, string[]> = {
  kinder: ['Maternal', 'Preescolar 1', 'Preescolar 2', 'Preescolar 3'],
  primaria: ['1ro A', '2do A', '3ro A', '4to A', '5to A', '6to A'],
  secundaria: ['1ro A', '2do A', '3ro A'],
  prepa: ['Semestre 1', 'Semestre 2', 'Semestre 3', 'Semestre 4', 'Semestre 5', 'Semestre 6'],
  universidad: ['Cuatrimestre 1', 'Cuatrimestre 2', 'Cuatrimestre 3'],
  academia: ['Principiantes', 'Intermedios', 'Avanzados'],
  otro: ['Grupo 1', 'Grupo 2'],
};
