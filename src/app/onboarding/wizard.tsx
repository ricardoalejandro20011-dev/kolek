'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  UserPlus,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { brand } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState, IlustraAlumnos, IlustraGrupos } from '@/components/empty-state';
import { createClient } from '@/lib/supabase/client';
import { CSV_PLANTILLA, descargarTexto, parseAlumnosCsv, type ResultadoCsv } from '@/lib/csv';
import { PLAN_POR_ID, planRecomendado } from '@/lib/plans';
import { formatMXN } from '@/lib/fees';
import {
  NIVELES,
  SUGERENCIAS_GRUPOS,
  type Concept,
  type Group,
  type School,
  type SchoolNivel,
} from '@/lib/types';
import { cn, normalizarWhatsapp, slugify, whatsappValido } from '@/lib/utils';

const PASOS = [
  { n: 1, titulo: 'Tu escuela', sub: 'Nombre, nivel y tamaño' },
  { n: 2, titulo: 'Grupos y alumnos', sub: 'Como los llamas tú' },
  { n: 3, titulo: 'Conceptos', sub: 'Qué vas a cobrar' },
];

interface Props {
  userId: string;
  email: string;
  school: School | null;
  gruposIniciales: Group[];
  conceptosIniciales: Concept[];
  totalAlumnosIniciales: number;
  planSugerido: string | null;
}

export function OnboardingWizard({
  userId,
  school: schoolInicial,
  gruposIniciales,
  conceptosIniciales,
  totalAlumnosIniciales,
  planSugerido,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [paso, setPaso] = useState(schoolInicial ? 2 : 1);
  const [school, setSchool] = useState<School | null>(schoolInicial);
  const [grupos, setGrupos] = useState<Group[]>(gruposIniciales);
  const [conceptos, setConceptos] = useState<Concept[]>(conceptosIniciales);
  const [totalAlumnos, setTotalAlumnos] = useState(totalAlumnosIniciales);
  const [guardando, setGuardando] = useState(false);

  /* ── PASO 1: escuela ─────────────────────────────────────────────── */
  const [nombre, setNombre] = useState(schoolInicial?.name ?? '');
  const [nivel, setNivel] = useState<SchoolNivel>(schoolInicial?.nivel ?? 'primaria');
  const [whatsapp, setWhatsapp] = useState(schoolInicial?.whatsapp ?? '');
  const [alumnosAprox, setAlumnosAprox] = useState<number>(180);
  const [rfc, setRfc] = useState(schoolInicial?.rfc ?? '');

  const recomendado = planRecomendado(alumnosAprox);
  const planRec = recomendado === 'medida' ? null : PLAN_POR_ID[recomendado];

  async function slugDisponible(base: string): Promise<string> {
    let intento = base || 'escuela';
    for (let i = 0; i < 12; i++) {
      const { data } = await supabase
        .from('schools')
        .select('id')
        .eq('slug', intento)
        .maybeSingle();
      if (!data) return intento;
      intento = `${base}-${i + 2}`;
    }
    return `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async function guardarEscuela() {
    if (!nombre.trim()) {
      toast.error('Ponle nombre a tu escuela.');
      return;
    }
    if (whatsapp && !whatsappValido(whatsapp)) {
      toast.error('El WhatsApp de la escuela debe ser un número mexicano de 10 dígitos.');
      return;
    }

    setGuardando(true);
    try {
      const plan = recomendado === 'medida' ? 'pro' : recomendado;

      if (school) {
        const { data, error } = await supabase
          .from('schools')
          .update({
            name: nombre.trim(),
            nivel,
            whatsapp: whatsapp ? normalizarWhatsapp(whatsapp) : null,
            rfc: rfc.trim() || null,
            plan,
          })
          .eq('id', school.id)
          .select()
          .single();
        if (error) throw error;
        setSchool(data as School);
      } else {
        const slug = await slugDisponible(slugify(nombre));
        const { data, error } = await supabase
          .from('schools')
          .insert({
            name: nombre.trim(),
            slug,
            nivel,
            whatsapp: whatsapp ? normalizarWhatsapp(whatsapp) : null,
            rfc: rfc.trim() || null,
            plan,
          })
          .select()
          .single();
        if (error) throw error;

        const { error: errPerfil } = await supabase
          .from('profiles')
          .update({ school_id: data.id })
          .eq('id', userId);
        if (errPerfil) throw errPerfil;

        setSchool(data as School);
      }

      toast.success('Escuela guardada');
      setPaso(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la escuela');
    } finally {
      setGuardando(false);
    }
  }

  /* ── PASO 2: grupos ──────────────────────────────────────────────── */
  const [nuevoGrupo, setNuevoGrupo] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState<string>('');

  async function crearGrupos(nombres: { nombre: string; monto: number }[]) {
    if (!school || nombres.length === 0) return [] as Group[];
    const existentes = new Set(grupos.map((g) => g.nombre.toLowerCase()));
    const nuevos = nombres.filter((n) => n.nombre && !existentes.has(n.nombre.toLowerCase()));
    if (!nuevos.length) return [];

    const { data, error } = await supabase
      .from('groups')
      .insert(
        nuevos.map((n, i) => ({
          school_id: school.id,
          nombre: n.nombre.trim(),
          monto_default: n.monto || 0,
          orden: grupos.length + i,
        })),
      )
      .select();

    if (error) {
      toast.error(error.message);
      return [];
    }
    const creados = (data as Group[]) ?? [];
    setGrupos((prev) => [...prev, ...creados]);
    return creados;
  }

  async function agregarGrupoManual() {
    const nom = nuevoGrupo.trim();
    if (!nom) return;
    const monto = Number(nuevoMonto) || 0;
    const creados = await crearGrupos([{ nombre: nom, monto }]);
    if (creados.length) {
      setNuevoGrupo('');
      // El monto se conserva: casi siempre el siguiente grupo cobra igual.
      toast.success(`Grupo "${nom}" creado`);
    } else {
      toast.error(`Ya tienes un grupo llamado "${nom}"`);
    }
  }

  async function agregarSugeridos() {
    const monto = Number(nuevoMonto) || 0;
    const creados = await crearGrupos(
      SUGERENCIAS_GRUPOS[nivel].map((nombre) => ({ nombre, monto })),
    );
    if (creados.length) toast.success(`${creados.length} grupos creados`);
    else toast.info('Ya tenías todos esos grupos');
  }

  async function actualizarMontoGrupo(id: string, monto: number) {
    setGrupos((prev) => prev.map((g) => (g.id === id ? { ...g, monto_default: monto } : g)));
    const { error } = await supabase
      .from('groups')
      .update({ monto_default: monto })
      .eq('id', id);
    if (error) toast.error(error.message);
  }

  async function borrarGrupo(id: string) {
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setGrupos((prev) => prev.filter((g) => g.id !== id));
  }

  /* ── PASO 2: alumnos por CSV ─────────────────────────────────────── */
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<ResultadoCsv | null>(null);
  const [importando, setImportando] = useState(false);

  async function leerArchivo(file: File) {
    const texto = await file.text();
    const res = parseAlumnosCsv(texto);
    setCsv(res);
    if (!res.filas.length) {
      toast.error('No encontré alumnos válidos en ese archivo.');
    } else {
      toast.success(`${res.filas.length} alumnos listos para importar`);
    }
  }

  async function importarCsv() {
    if (!school || !csv?.filas.length) return;
    setImportando(true);
    try {
      // 1. Crear los grupos que menciona el CSV y todavía no existen.
      const montoPorGrupo = new Map<string, number>();
      for (const f of csv.filas) {
        if (f.grupo && f.monto && !montoPorGrupo.has(f.grupo)) {
          montoPorGrupo.set(f.grupo, f.monto);
        }
      }
      const creados = await crearGrupos(
        csv.gruposDetectados.map((nombre) => ({
          nombre,
          monto: montoPorGrupo.get(nombre) ?? 0,
        })),
      );

      const indice = new Map<string, string>();
      for (const g of [...grupos, ...creados]) indice.set(g.nombre.toLowerCase(), g.id);

      // 2. Insertar alumnos en lotes de 200.
      const filas = csv.filas.map((f) => ({
        school_id: school.id,
        group_id: f.grupo ? (indice.get(f.grupo.toLowerCase()) ?? null) : null,
        nombre_alumno: f.nombre_alumno,
        nombre_tutor: f.nombre_tutor,
        whatsapp_tutor: f.whatsapp_tutor,
        email_tutor: f.email_tutor,
        monto_custom: f.monto,
        status: 'activo' as const,
      }));

      let insertados = 0;
      for (let i = 0; i < filas.length; i += 200) {
        const lote = filas.slice(i, i + 200);
        const { error } = await supabase.from('students').insert(lote);
        if (error) throw error;
        insertados += lote.length;
      }

      setTotalAlumnos((n) => n + insertados);
      setCsv(null);
      if (inputArchivo.current) inputArchivo.current.value = '';
      toast.success(`${insertados} alumnos importados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falló la importación');
    } finally {
      setImportando(false);
    }
  }

  /* ── PASO 2: alumno manual ───────────────────────────────────────── */
  const [alumnoNombre, setAlumnoNombre] = useState('');
  const [alumnoTutor, setAlumnoTutor] = useState('');
  const [alumnoWa, setAlumnoWa] = useState('');
  const [alumnoGrupo, setAlumnoGrupo] = useState<string>('');
  const [alumnoMonto, setAlumnoMonto] = useState('');
  const [agregandoAlumno, setAgregandoAlumno] = useState(false);
  const refNombreAlumno = useRef<HTMLInputElement>(null);

  async function agregarAlumno() {
    if (!school) return;
    if (!alumnoNombre.trim()) return toast.error('Falta el nombre del alumno');
    if (!whatsappValido(alumnoWa)) return toast.error('El WhatsApp del tutor no es válido');

    setAgregandoAlumno(true);
    const { error } = await supabase.from('students').insert({
      school_id: school.id,
      group_id: alumnoGrupo || null,
      nombre_alumno: alumnoNombre.trim(),
      nombre_tutor: alumnoTutor.trim() || `Tutor de ${alumnoNombre.trim()}`,
      whatsapp_tutor: normalizarWhatsapp(alumnoWa),
      monto_custom: alumnoMonto ? Number(alumnoMonto) : null,
      status: 'activo',
    });
    setAgregandoAlumno(false);

    if (error) return toast.error(error.message);

    setTotalAlumnos((n) => n + 1);
    setAlumnoNombre('');
    setAlumnoTutor('');
    setAlumnoWa('');
    setAlumnoMonto('');
    refNombreAlumno.current?.focus();
    toast.success('Alumno agregado');
  }

  /* ── PASO 3: conceptos ───────────────────────────────────────────── */
  const [conceptoNombre, setConceptoNombre] = useState('');
  const [conceptoRecurrente, setConceptoRecurrente] = useState(true);
  const [conceptoMontoFijo, setConceptoMontoFijo] = useState('');
  const [diaVencimiento, setDiaVencimiento] = useState(school?.dia_vencimiento ?? 5);

  async function crearConcepto(
    nombre: string,
    recurrente: boolean,
    montoFijo: number | null,
  ) {
    if (!school || !nombre.trim()) return;
    if (conceptos.some((c) => c.nombre.toLowerCase() === nombre.trim().toLowerCase())) {
      toast.error(`Ya tienes el concepto "${nombre}"`);
      return;
    }
    const { data, error } = await supabase
      .from('concepts')
      .insert({
        school_id: school.id,
        nombre: nombre.trim(),
        es_recurrente: recurrente,
        monto_fijo: montoFijo,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setConceptos((prev) => [...prev, data as Concept]);
    setConceptoNombre('');
    setConceptoMontoFijo('');
    toast.success(`Concepto "${nombre}" creado`);
  }

  async function borrarConcepto(id: string) {
    const { error } = await supabase.from('concepts').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setConceptos((prev) => prev.filter((c) => c.id !== id));
  }

  async function terminar() {
    if (!school) return;
    if (!conceptos.length) {
      toast.error('Crea al menos un concepto, normalmente "Colegiatura".');
      return;
    }
    setGuardando(true);
    const res = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia_vencimiento: diaVencimiento }),
    });
    const json = await res.json().catch(() => ({}));
    setGuardando(false);

    if (!res.ok) return toast.error(json.error ?? 'No se pudo completar el onboarding');

    toast.success('Tu escuela está lista');
    router.push('/dashboard');
    router.refresh();
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-white">
      {/* Encabezado con progreso */}
      <header className="sticky top-0 z-30 border-b border-[#111111]/[0.08] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-6 px-6">
          <Link href="/" aria-label={brand.name}>
            <Logo />
          </Link>

          <ol className="ml-auto hidden items-center gap-1 md:flex">
            {PASOS.map((p, i) => {
              const activo = paso === p.n;
              const listo = paso > p.n;
              return (
                <li key={p.n} className="flex items-center">
                  <button
                    type="button"
                    disabled={!school && p.n > 1}
                    onClick={() => (school || p.n === 1) && setPaso(p.n)}
                    className={cn(
                      'flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      activo ? 'bg-[#111111]/[0.05] text-ink' : 'text-muted-foreground hover:text-ink',
                    )}
                  >
                    <span
                      className={cn(
                        'tnum flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold',
                        listo
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : activo
                            ? 'border-ink text-ink'
                            : 'border-[#111111]/20 text-muted-foreground',
                      )}
                    >
                      {listo ? <Check className="h-3 w-3" strokeWidth={3} /> : p.n}
                    </span>
                    {p.titulo}
                  </button>
                  {i < PASOS.length - 1 && (
                    <span className="mx-1 h-px w-6 bg-[#111111]/12" aria-hidden />
                  )}
                </li>
              );
            })}
          </ol>

          <span className="ml-auto text-[13px] text-muted-foreground md:hidden">
            Paso {paso} de 3
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-6 py-12">
        {/* ══ PASO 1 ══════════════════════════════════════════════════ */}
        {paso === 1 && (
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="eyebrow">Paso 1 de 3</p>
              <h1 className="mt-3 text-display-md text-ink">Cuéntanos de tu escuela.</h1>
              <p className="mt-4 max-w-[40ch] text-[15px] leading-relaxed text-muted-foreground">
                Con el nivel educativo te proponemos grupos de arranque, y con el número de
                alumnos te decimos qué plan te conviene. Todo se puede cambiar después.
              </p>

              {planRec ? (
                <div className="mt-8 rounded-[12px] border border-brand-200 bg-brand-50/60 p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-600" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
                      Plan recomendado
                    </p>
                  </div>
                  <p className="mt-3 text-[19px] font-semibold tracking-[-0.02em] text-ink">
                    {planRec.nombre} · ${planRec.precio.toLocaleString('es-MX')} MXN/mes
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-brand-900/70">
                    {planRec.gancho}. {planRec.ideal}
                  </p>
                </div>
              ) : (
                <div className="mt-8 rounded-[12px] border border-[#111111]/[0.09] bg-[#111111]/[0.02] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Plan a la medida
                  </p>
                  <p className="mt-3 text-[15px] font-semibold tracking-[-0.015em]">
                    Más de 800 alumnos
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Te contactamos para armar precio por alumno y onboarding asistido. Mientras
                    tanto puedes usar la cuenta sin límite durante la configuración.
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-[12px] border border-[#111111]/[0.09] bg-white p-7 shadow-subtle">
                <div className="grid gap-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-nombre">Nombre de la escuela</Label>
                    <Input
                      id="s-nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Colegio Ignacio Zaragoza"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="s-nivel">Nivel educativo</Label>
                      <Select value={nivel} onValueChange={(v) => setNivel(v as SchoolNivel)}>
                        <SelectTrigger id="s-nivel">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NIVELES.map((n) => (
                            <SelectItem key={n.value} value={n.value}>
                              {n.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[12px] text-muted-foreground">
                        {NIVELES.find((n) => n.value === nivel)?.ejemplo}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="s-wa">WhatsApp de la escuela</Label>
                      <Input
                        id="s-wa"
                        inputMode="tel"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="55 1234 5678"
                      />
                      <p className="text-[12px] text-muted-foreground">
                        Al que los papás pueden responder dudas.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="s-alumnos">¿Cuántos alumnos tienes, aproximadamente?</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="s-alumnos"
                        type="number"
                        min={1}
                        max={5000}
                        className="tnum w-32"
                        value={alumnosAprox}
                        onChange={(e) => setAlumnosAprox(Number(e.target.value) || 0)}
                      />
                      {[40, 60, 180, 300, 500, 800].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAlumnosAprox(n)}
                          className={cn(
                            'tnum rounded-full border px-3 py-1 text-[12px] transition-colors',
                            alumnosAprox === n
                              ? 'border-brand-400 bg-brand-50 text-brand-700'
                              : 'border-[#111111]/12 text-muted-foreground hover:border-[#111111]/25',
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="s-rfc">
                      RFC <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="s-rfc"
                      value={rfc}
                      onChange={(e) => setRfc(e.target.value.toUpperCase())}
                      placeholder="CIZ850101ABC"
                      maxLength={13}
                      className="uppercase"
                    />
                  </div>
                </div>

                <div className="mt-7 flex items-center justify-between border-t border-[#111111]/[0.07] pt-5">
                  <p className="text-[12px] text-muted-foreground">
                    {planSugerido ? `Venías del plan ${planSugerido}. ` : ''}
                    Puedes cambiar de plan cuando quieras.
                  </p>
                  <Button variant="brand" onClick={guardarEscuela} loading={guardando}>
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ PASO 2 ══════════════════════════════════════════════════ */}
        {paso === 2 && school && (
          <div>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="eyebrow">Paso 2 de 3</p>
                <h1 className="mt-3 text-display-md text-ink">Tus grupos y tus alumnos.</h1>
                <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-muted-foreground">
                  Llámalos como los llamas todos los días: “1ro A”, “Avanzados Lunes”,
                  “Cuatrimestre 3”, “Cinta Negra”. {brand.name} no asume nada.
                </p>
              </div>
              <div className="flex shrink-0 gap-6">
                <div>
                  <p className="tnum text-[26px] font-semibold tracking-[-0.03em]">
                    {grupos.length}
                  </p>
                  <p className="text-[12px] text-muted-foreground">Grupos</p>
                </div>
                <div>
                  <p className="tnum text-[26px] font-semibold tracking-[-0.03em]">
                    {totalAlumnos}
                  </p>
                  <p className="text-[12px] text-muted-foreground">Alumnos</p>
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-12">
              {/* Grupos */}
              <section className="lg:col-span-5">
                <div className="rounded-[12px] border border-[#111111]/[0.09] bg-white shadow-subtle">
                  <div className="border-b border-[#111111]/[0.07] p-5">
                    <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Grupos</h2>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      El monto por defecto se aplica a todos los alumnos del grupo.
                    </p>

                    <div className="mt-4 flex gap-2">
                      <Input
                        value={nuevoGrupo}
                        onChange={(e) => setNuevoGrupo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void agregarGrupoManual();
                          }
                        }}
                        placeholder="Nombre del grupo"
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={nuevoMonto}
                        onChange={(e) => setNuevoMonto(e.target.value)}
                        placeholder="$ monto"
                        className="tnum w-28"
                      />
                      <Button size="icon" variant="brand" onClick={agregarGrupoManual}>
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Agregar grupo</span>
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={agregarSugeridos}
                      className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-600 hover:underline"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Agregar los típicos de {NIVELES.find((n) => n.value === nivel)?.label}
                    </button>
                  </div>

                  {grupos.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<IlustraGrupos />}
                      title="Todavía no hay grupos"
                      description="Crea el primero arriba o usa los sugeridos de tu nivel educativo."
                    />
                  ) : (
                    <ul className="divide-y divide-[#111111]/[0.06]">
                      {grupos.map((g) => (
                        <li key={g.id} className="flex items-center gap-3 px-5 py-3">
                          <span className="flex-1 truncate text-[13px] font-medium text-ink">
                            {g.nombre}
                          </span>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                              $
                            </span>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              defaultValue={g.monto_default || ''}
                              onBlur={(e) =>
                                actualizarMontoGrupo(g.id, Number(e.target.value) || 0)
                              }
                              className="tnum h-8 w-28 pl-5 text-[13px]"
                            />
                          </div>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => borrarGrupo(g.id)}
                            aria-label={`Borrar ${g.nombre}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Alumnos */}
              <section className="lg:col-span-7">
                <div className="rounded-[12px] border border-[#111111]/[0.09] bg-white shadow-subtle">
                  <div className="flex items-center justify-between border-b border-[#111111]/[0.07] p-5">
                    <div>
                      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Alumnos</h2>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Importa tu lista o agrégalos uno por uno.
                      </p>
                    </div>
                    <Badge variant={totalAlumnos ? 'brand' : 'neutral'} className="tnum">
                      {totalAlumnos} cargados
                    </Badge>
                  </div>

                  <Tabs defaultValue="csv" className="p-5">
                    <TabsList>
                      <TabsTrigger value="csv">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Importar CSV
                      </TabsTrigger>
                      <TabsTrigger value="manual">
                        <UserPlus className="h-3.5 w-3.5" />
                        Agregar manual
                      </TabsTrigger>
                    </TabsList>

                    {/* CSV */}
                    <TabsContent value="csv" className="mt-5">
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const f = e.dataTransfer.files?.[0];
                          if (f) void leerArchivo(f);
                        }}
                        className="rounded-[12px] border border-dashed border-[#111111]/15 bg-[#111111]/[0.015] px-6 py-10 text-center"
                      >
                        <Upload className="mx-auto h-5 w-5 text-muted-foreground" strokeWidth={1.6} />
                        <p className="mt-3 text-[13px] font-medium text-ink">
                          Arrastra tu archivo o selecciónalo
                        </p>
                        <p className="mx-auto mt-1 max-w-[48ch] text-[12px] leading-relaxed text-muted-foreground">
                          Columnas: nombre_alumno, grupo, monto, nombre_tutor, whatsapp_tutor.
                          Aceptamos variantes en español y el orden no importa.
                        </p>
                        <input
                          ref={inputArchivo}
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void leerArchivo(f);
                          }}
                        />
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => inputArchivo.current?.click()}>
                            Seleccionar archivo
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => descargarTexto('plantilla-kolek.csv', CSV_PLANTILLA)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Descargar plantilla
                          </Button>
                        </div>
                      </div>

                      {csv && (
                        <div className="mt-5 rounded-[12px] border border-[#111111]/[0.09]">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#111111]/[0.07] px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="pagado">{csv.filas.length} válidos</Badge>
                              {csv.errores.length > 0 && (
                                <Badge variant="atrasado">{csv.errores.length} con problema</Badge>
                              )}
                              {csv.gruposDetectados.length > 0 && (
                                <Badge variant="outline">
                                  {csv.gruposDetectados.length} grupos detectados
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setCsv(null)}>
                                Descartar
                              </Button>
                              <Button
                                size="sm"
                                variant="brand"
                                onClick={importarCsv}
                                loading={importando}
                                disabled={!csv.filas.length}
                              >
                                Importar {csv.filas.length}
                              </Button>
                            </div>
                          </div>

                          <div className="max-h-56 overflow-y-auto thin-scrollbar">
                            <table className="w-full text-left text-[12px]">
                              <thead className="sticky top-0 bg-white">
                                <tr className="border-b border-[#111111]/[0.07] text-[10px] uppercase tracking-wider text-muted-foreground">
                                  <th className="px-4 py-2 font-medium">Alumno</th>
                                  <th className="px-4 py-2 font-medium">Grupo</th>
                                  <th className="px-4 py-2 font-medium">Tutor</th>
                                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {csv.filas.slice(0, 60).map((f, i) => (
                                  <tr key={i} className="border-b border-[#111111]/[0.05]">
                                    <td className="px-4 py-1.5 font-medium">{f.nombre_alumno}</td>
                                    <td className="px-4 py-1.5 text-muted-foreground">
                                      {f.grupo || '—'}
                                    </td>
                                    <td className="px-4 py-1.5 text-muted-foreground">
                                      {f.nombre_tutor}
                                    </td>
                                    <td className="tnum px-4 py-1.5 text-right">
                                      {f.monto ? formatMXN(f.monto) : 'del grupo'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {csv.filas.length > 60 && (
                              <p className="px-4 py-2 text-[11px] text-muted-foreground">
                                …y {csv.filas.length - 60} más.
                              </p>
                            )}
                          </div>

                          {csv.errores.length > 0 && (
                            <div className="border-t border-[#111111]/[0.07] bg-red-50/50 px-4 py-3">
                              <p className="flex items-center gap-1.5 text-[12px] font-medium text-red-700">
                                <TriangleAlert className="h-3.5 w-3.5" />
                                Estas filas no se van a importar
                              </p>
                              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-red-700/85">
                                {csv.errores.slice(0, 20).map((e, i) => (
                                  <li key={i}>
                                    Línea {e.linea}: {e.motivo}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    {/* Manual */}
                    <TabsContent value="manual" className="mt-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="a-nombre">Nombre del alumno</Label>
                          <Input
                            id="a-nombre"
                            ref={refNombreAlumno}
                            value={alumnoNombre}
                            onChange={(e) => setAlumnoNombre(e.target.value)}
                            placeholder="Renata Ibarra Solís"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="a-grupo">Grupo</Label>
                          <Select value={alumnoGrupo} onValueChange={setAlumnoGrupo}>
                            <SelectTrigger id="a-grupo">
                              <SelectValue placeholder="Sin grupo" />
                            </SelectTrigger>
                            <SelectContent>
                              {grupos.map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                  {g.nombre}
                                  {g.monto_default ? ` · ${formatMXN(g.monto_default)}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="a-tutor">Nombre del tutor</Label>
                          <Input
                            id="a-tutor"
                            value={alumnoTutor}
                            onChange={(e) => setAlumnoTutor(e.target.value)}
                            placeholder="Mariana Solís"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="a-wa">WhatsApp del tutor</Label>
                          <Input
                            id="a-wa"
                            inputMode="tel"
                            value={alumnoWa}
                            onChange={(e) => setAlumnoWa(e.target.value)}
                            placeholder="55 1234 5678"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="a-monto">
                            Monto propio{' '}
                            <span className="font-normal text-muted-foreground">
                              (opcional — si lo dejas vacío usa el del grupo)
                            </span>
                          </Label>
                          <Input
                            id="a-monto"
                            type="number"
                            min={0}
                            step="0.01"
                            value={alumnoMonto}
                            onChange={(e) => setAlumnoMonto(e.target.value)}
                            placeholder="Becado, descuento por hermano…"
                            className="tnum"
                          />
                        </div>
                      </div>

                      <Button
                        variant="brand"
                        className="mt-5"
                        onClick={agregarAlumno}
                        loading={agregandoAlumno}
                      >
                        <Plus className="h-4 w-4" />
                        Agregar y seguir
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>

                {totalAlumnos === 0 && grupos.length > 0 && (
                  <div className="mt-4 rounded-[12px] border border-[#111111]/[0.09] bg-white">
                    <EmptyState
                      compact
                      icon={<IlustraAlumnos />}
                      title="Ya tienes grupos, faltan los alumnos"
                      description="Si tienes la lista en Excel, guárdala como CSV y arrástrala arriba: es lo más rápido."
                    />
                  </div>
                )}
              </section>
            </div>

            <div className="mt-10 flex items-center justify-between border-t border-[#111111]/[0.08] pt-6">
              <Button variant="ghost" onClick={() => setPaso(1)}>
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
              <Button
                variant="brand"
                onClick={() => {
                  if (!totalAlumnos) {
                    toast.error('Agrega al menos un alumno para continuar.');
                    return;
                  }
                  setPaso(3);
                }}
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ══ PASO 3 ══════════════════════════════════════════════════ */}
        {paso === 3 && school && (
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="eyebrow">Paso 3 de 3</p>
              <h1 className="mt-3 text-display-md text-ink">¿Qué vas a cobrar?</h1>
              <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-muted-foreground">
                Un concepto <strong className="text-ink">recurrente</strong> se cobra cada mes
                (colegiatura). Uno no recurrente se cobra una vez al ciclo que tú elijas
                (inscripción, uniforme, examen, curso de verano).
              </p>

              <div className="mt-8 space-y-2">
                <Label htmlFor="dia-venc">Día de vencimiento de cada mes</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 5, 10, 15, 20].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiaVencimiento(d)}
                      className={cn(
                        'tnum h-9 w-9 rounded-[10px] border text-[13px] transition-colors',
                        diaVencimiento === d
                          ? 'border-brand-400 bg-brand-50 text-brand-700'
                          : 'border-[#111111]/12 text-muted-foreground hover:border-[#111111]/25',
                      )}
                    >
                      {d}
                    </button>
                  ))}
                  <Input
                    id="dia-venc"
                    type="number"
                    min={1}
                    max={28}
                    value={diaVencimiento}
                    onChange={(e) =>
                      setDiaVencimiento(Math.min(28, Math.max(1, Number(e.target.value) || 1)))
                    }
                    className="tnum h-9 w-20"
                  />
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Después de ese día los pagos pendientes se marcan como atrasados.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-[12px] border border-[#111111]/[0.09] bg-white shadow-subtle">
                <div className="border-b border-[#111111]/[0.07] p-5">
                  <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Conceptos</h2>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <Input
                      value={conceptoNombre}
                      onChange={(e) => setConceptoNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void crearConcepto(
                            conceptoNombre,
                            conceptoRecurrente,
                            conceptoMontoFijo ? Number(conceptoMontoFijo) : null,
                          );
                        }
                      }}
                      placeholder="Colegiatura, Inscripción, Uniforme…"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={conceptoMontoFijo}
                      onChange={(e) => setConceptoMontoFijo(e.target.value)}
                      placeholder="Monto fijo"
                      className="tnum sm:w-32"
                    />
                    <Button
                      variant="brand"
                      onClick={() =>
                        crearConcepto(
                          conceptoNombre,
                          conceptoRecurrente,
                          conceptoMontoFijo ? Number(conceptoMontoFijo) : null,
                        )
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </Button>
                  </div>

                  <div className="mt-3 flex items-center gap-2.5">
                    <Switch
                      id="recurrente"
                      checked={conceptoRecurrente}
                      onCheckedChange={setConceptoRecurrente}
                    />
                    <Label htmlFor="recurrente" className="cursor-pointer font-normal">
                      Se cobra todos los meses
                    </Label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[
                      { n: 'Colegiatura', r: true },
                      { n: 'Inscripción', r: false },
                      { n: 'Uniforme', r: false },
                      { n: 'Examen', r: false },
                      { n: 'Curso de verano', r: false },
                      { n: 'Material', r: false },
                    ]
                      .filter(
                        (s) =>
                          !conceptos.some(
                            (c) => c.nombre.toLowerCase() === s.n.toLowerCase(),
                          ),
                      )
                      .map((s) => (
                        <button
                          key={s.n}
                          type="button"
                          onClick={() => crearConcepto(s.n, s.r, null)}
                          className="rounded-full border border-[#111111]/12 px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:border-brand-300 hover:text-brand-700"
                        >
                          + {s.n}
                        </button>
                      ))}
                  </div>
                </div>

                {conceptos.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<IlustraGrupos />}
                    title="Sin conceptos todavía"
                    description="Casi todas las escuelas empiezan con Colegiatura mensual. Toca el atajo de arriba."
                  />
                ) : (
                  <ul className="divide-y divide-[#111111]/[0.06]">
                    {conceptos.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">{c.nombre}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {c.es_recurrente ? 'Mensual recurrente' : 'Cobro único por ciclo'}
                            {c.monto_fijo ? ` · ${formatMXN(c.monto_fijo)} para todos` : ''}
                          </p>
                        </div>
                        <Badge variant={c.es_recurrente ? 'brand' : 'outline'}>
                          {c.es_recurrente ? 'Recurrente' : 'Único'}
                        </Badge>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => borrarConcepto(c.id)}
                          aria-label={`Borrar ${c.nombre}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-[#111111]/[0.08] pt-6">
                <Button variant="ghost" onClick={() => setPaso(2)}>
                  <ArrowLeft className="h-4 w-4" />
                  Atrás
                </Button>
                <Button variant="brand" size="lg" onClick={terminar} loading={guardando}>
                  Entrar al dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
