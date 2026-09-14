'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  MessageCircle,
  Plus,
  Trash2,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { brand } from '@/config/brand';
import { calcTotalConComision, formatMXN } from '@/lib/fees';
import { PLAN_POR_ID, PLANES } from '@/lib/plans';
import type { Subscription } from '@/lib/subscriptions';
import { NIVELES, type Concept, type Group, type Profile, type School, type SchoolNivel, type SchoolPlan } from '@/lib/types';
import { cn, normalizarWhatsapp, whatsappValido } from '@/lib/utils';

export interface MpConexionPublica {
  status: 'disconnected' | 'connected' | 'error';
  external_account_id: string | null;
  public_key: string | null;
  last_error: string | null;
}

export function SettingsView({
  school: schoolInicial,
  grupos: gruposIniciales,
  conceptos: conceptosIniciales,
  equipo: equipoInicial,
  miId,
  miRol,
  alumnosPorGrupo,
  mpConexion,
  mpPlataformaConfigurada,
  suscripcion,
}: {
  school: School;
  grupos: Group[];
  conceptos: Concept[];
  equipo: Profile[];
  miId: string;
  miRol: string;
  alumnosPorGrupo: Record<string, number>;
  mpConexion: MpConexionPublica | null;
  mpPlataformaConfigurada: boolean;
  suscripcion: Subscription | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [school, setSchool] = useState(schoolInicial);

  async function guardarEscuela(patch: Partial<School>, mensaje = 'Guardado'): Promise<void> {
    const { data, error } = await supabase
      .from('schools')
      .update(patch)
      .eq('id', school.id)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setSchool(data as School);
    toast.success(mensaje);
    router.refresh();
  }

  return (
    <Tabs defaultValue="escuela" className="space-y-6">
      <TabsList>
        <TabsTrigger value="escuela">Escuela</TabsTrigger>
        <TabsTrigger value="grupos">Grupos y montos</TabsTrigger>
        <TabsTrigger value="conceptos">Conceptos</TabsTrigger>
        <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
        <TabsTrigger value="equipo">Equipo</TabsTrigger>
        <TabsTrigger value="plan">Plan</TabsTrigger>
      </TabsList>

      <TabsContent value="escuela">
        <PerfilEscuela school={school} onGuardar={guardarEscuela} />
      </TabsContent>

      <TabsContent value="grupos">
        <GruposMontos
          schoolId={school.id}
          gruposIniciales={gruposIniciales}
          alumnosPorGrupo={alumnosPorGrupo}
        />
      </TabsContent>

      <TabsContent value="conceptos">
        <Conceptos schoolId={school.id} conceptosIniciales={conceptosIniciales} />
      </TabsContent>

      <TabsContent value="integraciones">
        <Integraciones
          school={school}
          onGuardar={guardarEscuela}
          mpConexion={mpConexion}
          mpPlataformaConfigurada={mpPlataformaConfigurada}
        />
      </TabsContent>

      <TabsContent value="equipo">
        <Equipo equipoInicial={equipoInicial} miId={miId} miRol={miRol} plan={school.plan} />
      </TabsContent>

      <TabsContent value="plan">
        <PlanActual school={school} suscripcion={suscripcion} />
      </TabsContent>
    </Tabs>
  );
}

/* ══ Sección: perfil de la escuela ═══════════════════════════════════ */

function Seccion({
  titulo,
  descripcion,
  children,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 border-b border-[#111111]/[0.08] py-8 first:pt-0 last:border-0 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.012em] text-ink">{titulo}</h2>
        {descripcion ? (
          <p className="mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-muted-foreground">
            {descripcion}
          </p>
        ) : null}
        {acciones ? <div className="mt-4">{acciones}</div> : null}
      </div>
      <div className="lg:col-span-8">{children}</div>
    </section>
  );
}

function PerfilEscuela({
  school,
  onGuardar,
}: {
  school: School;
  onGuardar: (patch: Partial<School>, mensaje?: string) => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [nombre, setNombre] = useState(school.name);
  const [nivel, setNivel] = useState<SchoolNivel>(school.nivel);
  const [whatsapp, setWhatsapp] = useState(school.whatsapp ?? '');
  const [rfc, setRfc] = useState(school.rfc ?? '');
  const [dia, setDia] = useState(school.dia_vencimiento);
  const [recordatorios, setRecordatorios] = useState<number[]>(school.recordatorios_dias ?? []);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const inputLogo = useRef<HTMLInputElement>(null);

  async function subirLogo(file: File) {
    if (file.size > 2_000_000) return toast.error('El logo debe pesar menos de 2 MB');
    setSubiendo(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const ruta = `${school.id}/logo-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('logos')
      .upload(ruta, file, { upsert: true, contentType: file.type });

    if (error) {
      setSubiendo(false);
      return toast.error(error.message);
    }

    const { data } = supabase.storage.from('logos').getPublicUrl(ruta);
    await onGuardar({ logo_url: data.publicUrl }, 'Logo actualizado');
    setSubiendo(false);
  }

  function toggleRecordatorio(d: number) {
    setRecordatorios((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  }

  async function guardar() {
    if (whatsapp && !whatsappValido(whatsapp)) {
      return toast.error('El WhatsApp debe ser un número mexicano de 10 dígitos');
    }
    setGuardando(true);
    await onGuardar({
      name: nombre.trim(),
      nivel,
      whatsapp: whatsapp ? normalizarWhatsapp(whatsapp) : null,
      rfc: rfc.trim() || null,
      dia_vencimiento: dia,
      recordatorios_dias: recordatorios,
    });
    setGuardando(false);
  }

  return (
    <div>
      <Seccion
        titulo="Datos de la escuela"
        descripcion="El nombre y el logo aparecen en la página de pago que ve el tutor."
      >
        <div className="grid gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[#111111]/[0.09] bg-[#111111]/[0.02]">
              {school.logo_url ? (
                <Image
                  src={school.logo_url}
                  alt={school.name}
                  width={64}
                  height={64}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              )}
            </div>
            <div>
              <input
                ref={inputLogo}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void subirLogo(f);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                loading={subiendo}
                onClick={() => inputLogo.current?.click()}
              >
                {school.logo_url ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                PNG, JPG o SVG. Máximo 2 MB.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-nombre">Nombre</Label>
              <Input id="c-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-nivel">Nivel educativo</Label>
              <Select value={nivel} onValueChange={(v) => setNivel(v as SchoolNivel)}>
                <SelectTrigger id="c-nivel">
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-wa">WhatsApp de la escuela</Label>
              <Input
                id="c-wa"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="55 1234 5678"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-rfc">RFC (opcional)</Label>
              <Input
                id="c-rfc"
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
                className="uppercase"
                maxLength={13}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>URL pública de tu escuela</Label>
            <Input readOnly value={`/${school.slug}`} className="bg-[#111111]/[0.02]" />
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Calendario de cobranza"
        descripcion="El día de vencimiento se aplica al generar cada ciclo. Después de esa fecha, los pagos pendientes se marcan como atrasados."
      >
        <div className="grid gap-6">
          <div className="space-y-2">
            <Label>Día de vencimiento</Label>
            <div className="flex flex-wrap gap-1.5">
              {[1, 5, 10, 15, 20].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDia(d)}
                  className={cn(
                    'tnum h-9 w-9 rounded-[10px] border text-[13px] transition-colors',
                    dia === d
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-[#111111]/12 text-muted-foreground hover:border-[#111111]/25',
                  )}
                >
                  {d}
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={28}
                value={dia}
                onChange={(e) => setDia(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                className="tnum h-9 w-20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Recordatorios automáticos</Label>
              <Badge variant="brand">Crecimiento y Pro</Badge>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Días del mes en que {brand.name} reenvía el link a quien no ha pagado.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 3, 5, 8, 10, 15, 20, 25].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleRecordatorio(d)}
                  className={cn(
                    'tnum h-9 w-9 rounded-[10px] border text-[13px] transition-colors',
                    recordatorios.includes(d)
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-[#111111]/12 text-muted-foreground hover:border-[#111111]/25',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            {school.plan === 'inicio' && (
              <p className="text-[12px] text-amber-700">
                Tu plan Inicio no incluye recordatorios automáticos.{' '}
                <Link href="/planes" className="font-medium underline">
                  Sube a Crecimiento
                </Link>{' '}
                para activarlos.
              </p>
            )}
          </div>

          <div>
            <Button variant="brand" onClick={guardar} loading={guardando}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </Seccion>
    </div>
  );
}

/* ══ Sección: grupos y montos masivos ════════════════════════════════ */

function GruposMontos({
  schoolId,
  gruposIniciales,
  alumnosPorGrupo,
}: {
  schoolId: string;
  gruposIniciales: Group[];
  alumnosPorGrupo: Record<string, number>;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [grupos, setGrupos] = useState(gruposIniciales);
  const [nuevo, setNuevo] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [montoMasivo, setMontoMasivo] = useState('');
  const [aplicando, setAplicando] = useState(false);

  async function crear() {
    if (!nuevo.trim()) return;
    const { data, error } = await supabase
      .from('groups')
      .insert({
        school_id: schoolId,
        nombre: nuevo.trim(),
        monto_default: Number(nuevoMonto) || 0,
        orden: grupos.length,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setGrupos((p) => [...p, data as Group]);
    setNuevo('');
    toast.success('Grupo creado');
  }

  async function actualizar(id: string, patch: Partial<Group>) {
    setGrupos((p) => p.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    const { error } = await supabase.from('groups').update(patch).eq('id', id);
    if (error) toast.error(error.message);
  }

  async function borrar(g: Group) {
    const { error } = await supabase.from('groups').delete().eq('id', g.id);
    if (error) return toast.error(error.message);
    setGrupos((p) => p.filter((x) => x.id !== g.id));
    toast.success(`Grupo "${g.nombre}" eliminado`, {
      description: 'Sus alumnos quedan sin grupo, no se borran.',
    });
    router.refresh();
  }

  async function aplicarATodos() {
    const monto = Number(montoMasivo);
    if (!monto || monto <= 0) return toast.error('Pon un monto válido');
    setAplicando(true);
    const { error } = await supabase
      .from('groups')
      .update({ monto_default: monto })
      .eq('school_id', schoolId);
    setAplicando(false);
    if (error) return toast.error(error.message);
    setGrupos((p) => p.map((g) => ({ ...g, monto_default: monto })));
    setMontoMasivo('');
    toast.success(`${grupos.length} grupos actualizados a ${formatMXN(monto)}`);
  }

  return (
    <div>
      <Seccion
        titulo="Edición masiva de montos"
        descripcion="Si toda la escuela cobra lo mismo, pon el monto una vez y aplícalo a todos los grupos. Los alumnos con monto propio (becados) no se tocan."
      >
        <div className="flex flex-wrap items-end gap-3 rounded-[12px] border border-[#111111]/[0.09] bg-[#111111]/[0.02] p-5">
          <div className="space-y-1.5">
            <Label htmlFor="masivo">Monto para todos los grupos</Label>
            <Input
              id="masivo"
              type="number"
              min={0}
              step="0.01"
              value={montoMasivo}
              onChange={(e) => setMontoMasivo(e.target.value)}
              placeholder="2450"
              className="tnum w-40"
            />
          </div>
          <Button variant="outline" onClick={aplicarATodos} loading={aplicando}>
            <Wand2 className="h-4 w-4" />
            Aplicar a los {grupos.length} grupos
          </Button>
          {montoMasivo && Number(montoMasivo) > 0 && (
            <p className="text-[12px] text-muted-foreground">
              El tutor pagaría {formatMXN(calcTotalConComision(Number(montoMasivo)))} con comisión.
            </p>
          )}
        </div>
      </Seccion>

      <Seccion
        titulo="Grupos"
        descripcion="Cambia el nombre o el monto de cada grupo. Los cambios se guardan al salir del campo."
      >
        <div className="rounded-[12px] border border-[#111111]/[0.09] bg-white">
          <div className="flex gap-2 border-b border-[#111111]/[0.07] p-4">
            <Input
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crear()}
              placeholder="Nombre del grupo nuevo"
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              value={nuevoMonto}
              onChange={(e) => setNuevoMonto(e.target.value)}
              placeholder="$ monto"
              className="tnum w-32"
            />
            <Button variant="brand" onClick={crear}>
              <Plus className="h-4 w-4" />
              Crear
            </Button>
          </div>

          {grupos.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              Todavía no tienes grupos.
            </p>
          ) : (
            <ul className="divide-y divide-[#111111]/[0.06]">
              {grupos.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Input
                    defaultValue={g.nombre}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== g.nombre) actualizar(g.id, { nombre: v });
                    }}
                    className="h-8 min-w-[140px] flex-1 text-[13px]"
                  />
                  <span className="tnum w-24 text-[12px] text-muted-foreground">
                    {alumnosPorGrupo[g.id] ?? 0} alumnos
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
                      onBlur={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (v !== Number(g.monto_default)) actualizar(g.id, { monto_default: v });
                      }}
                      className="tnum h-8 w-28 pl-5 text-[13px]"
                    />
                  </div>
                  <span className="tnum w-28 text-right text-[12px] text-muted-foreground">
                    tutor: {g.monto_default ? formatMXN(calcTotalConComision(Number(g.monto_default))) : '—'}
                  </span>
                  <Button size="icon-sm" variant="ghost" onClick={() => borrar(g)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="sr-only">Borrar {g.nombre}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Seccion>
    </div>
  );
}

/* ══ Sección: conceptos ══════════════════════════════════════════════ */

function Conceptos({
  schoolId,
  conceptosIniciales,
}: {
  schoolId: string;
  conceptosIniciales: Concept[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [conceptos, setConceptos] = useState(conceptosIniciales);
  const [nombre, setNombre] = useState('');
  const [recurrente, setRecurrente] = useState(true);
  const [montoFijo, setMontoFijo] = useState('');

  async function crear() {
    if (!nombre.trim()) return;
    const { data, error } = await supabase
      .from('concepts')
      .insert({
        school_id: schoolId,
        nombre: nombre.trim(),
        es_recurrente: recurrente,
        monto_fijo: montoFijo ? Number(montoFijo) : null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setConceptos((p) => [...p, data as Concept]);
    setNombre('');
    setMontoFijo('');
    toast.success('Concepto creado');
  }

  async function actualizar(id: string, patch: Partial<Concept>) {
    setConceptos((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from('concepts').update(patch).eq('id', id);
    if (error) toast.error(error.message);
  }

  async function borrar(c: Concept) {
    const { error } = await supabase.from('concepts').delete().eq('id', c.id);
    if (error) return toast.error(error.message);
    setConceptos((p) => p.filter((x) => x.id !== c.id));
    toast.success(`Concepto "${c.nombre}" eliminado`, {
      description: 'También se borraron sus pagos asociados.',
    });
  }

  return (
    <Seccion
      titulo="Conceptos que cobras"
      descripcion="Recurrente = se cobra cada mes (colegiatura). Único = se cobra una vez en el ciclo que elijas (inscripción, uniforme, examen). Si pones monto fijo, se le cobra igual a todos los alumnos."
    >
      <div id="conceptos" className="rounded-[12px] border border-[#111111]/[0.09] bg-white">
        <div className="space-y-3 border-b border-[#111111]/[0.07] p-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crear()}
              placeholder="Nombre del concepto"
              className="min-w-[180px] flex-1"
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              value={montoFijo}
              onChange={(e) => setMontoFijo(e.target.value)}
              placeholder="Monto fijo (opcional)"
              className="tnum w-44"
            />
            <Button variant="brand" onClick={crear}>
              <Plus className="h-4 w-4" />
              Crear
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <Switch id="rec" checked={recurrente} onCheckedChange={setRecurrente} />
            <Label htmlFor="rec" className="cursor-pointer font-normal">
              Se cobra todos los meses
            </Label>
          </div>
        </div>

        {conceptos.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
            Sin conceptos. Crea al menos “Colegiatura”.
          </p>
        ) : (
          <ul className="divide-y divide-[#111111]/[0.06]">
            {conceptos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Input
                  defaultValue={c.nombre}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== c.nombre) actualizar(c.id, { nombre: v });
                  }}
                  className="h-8 min-w-[150px] flex-1 text-[13px]"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={c.es_recurrente}
                    onCheckedChange={(v) => actualizar(c.id, { es_recurrente: v })}
                  />
                  <span className="w-20 text-[12px] text-muted-foreground">
                    {c.es_recurrente ? 'Mensual' : 'Único'}
                  </span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={c.monto_fijo ?? ''}
                    placeholder="variable"
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== (c.monto_fijo ?? null)) actualizar(c.id, { monto_fijo: v });
                    }}
                    className="tnum h-8 w-32 pl-5 text-[13px]"
                  />
                </div>
                <Button size="icon-sm" variant="ghost" onClick={() => borrar(c)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="sr-only">Borrar {c.nombre}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Seccion>
  );
}

/* ══ Sección: integraciones ══════════════════════════════════════════ */

function CampoSecreto({
  id,
  label,
  valor,
  onChange,
  placeholder,
  ayuda,
}: {
  id: string;
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ayuda?: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={ver ? 'text' : 'password'}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10 font-mono text-[12px]"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[6px] p-1.5 text-muted-foreground hover:bg-[#111111]/[0.05]"
          aria-label={ver ? 'Ocultar' : 'Mostrar'}
        >
          {ver ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      {ayuda ? <p className="text-[12px] leading-relaxed text-muted-foreground">{ayuda}</p> : null}
    </div>
  );
}

function Integraciones({
  school,
  onGuardar,
  mpConexion,
  mpPlataformaConfigurada,
}: {
  school: School;
  onGuardar: (patch: Partial<School>, mensaje?: string) => Promise<void>;
  mpConexion: MpConexionPublica | null;
  mpPlataformaConfigurada: boolean;
}) {
  const router = useRouter();
  const [waToken, setWaToken] = useState(school.whatsapp_token ?? '');
  const [waPhone, setWaPhone] = useState(school.whatsapp_phone_number_id ?? '');
  const [g2, setG2] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const conectado = mpConexion?.status === 'connected';
  const urlWebhook =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/whatsapp`
      : '/api/webhooks/whatsapp';

  async function desconectarMp() {
    setDesconectando(true);
    const res = await fetch('/api/integrations/mercadopago/disconnect', { method: 'POST' });
    setDesconectando(false);
    if (res.ok) {
      toast.success('Mercado Pago desconectado');
      router.refresh();
    } else {
      toast.error('No se pudo desconectar');
    }
  }

  return (
    <div>
      <Seccion
        titulo="Mercado Pago"
        descripcion={`Conectas tu propia cuenta por OAuth: el dinero de las colegiaturas cae directo a tu cuenta de Mercado Pago. ${brand.name} nunca ve tu contraseña ni toca ese dinero.`}
        acciones={
          <Button asChild size="sm" variant="outline">
            <a
              href="https://www.mercadopago.com.mx/developers/panel/app"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir panel de MP
            </a>
          </Button>
        }
      >
        <div className="space-y-5 rounded-[12px] border border-[#111111]/[0.09] bg-white p-5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <Badge variant={conectado ? 'pagado' : mpConexion?.status === 'error' ? 'atrasado' : 'neutral'}>
              {conectado
                ? 'Conectado'
                : mpConexion?.status === 'error'
                  ? 'Error al conectar'
                  : 'Sin conectar — modo de prueba'}
            </Badge>
          </div>

          {!mpPlataformaConfigurada ? (
            <div className="rounded-[10px] border border-[#111111]/[0.09] bg-[#111111]/[0.02] px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
              Kolek todavía no tiene registrada su aplicación de Mercado Pago a nivel plataforma.
              Mientras tanto, esta escuela cobra en <strong className="text-ink">modo de
              prueba</strong>: los links de pago funcionan de extremo a extremo con pagos
              simulados, sin ningún cargo real.
            </div>
          ) : conectado ? (
            <>
              <p className="text-[13px] text-ink/80">
                Cuenta conectada
                {mpConexion?.external_account_id ? `: ${mpConexion.external_account_id}` : ''}.
              </p>
              <Button variant="outline" loading={desconectando} onClick={desconectarMp}>
                Desconectar
              </Button>
            </>
          ) : (
            <>
              {mpConexion?.last_error && (
                <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {mpConexion.last_error}
                </p>
              )}
              <Button asChild variant="brand">
                <a href="/api/integrations/mercadopago/connect">
                  Conectar mi cuenta de Mercado Pago
                </a>
              </Button>
              <p className="text-[12px] text-muted-foreground">
                Mientras no conectes, los links de pago funcionan en modo de prueba: puedes
                probar todo el flujo (generar cobro, pagar, conciliar) sin que sea un cargo real.
              </p>
            </>
          )}
        </div>
      </Seccion>

      <Seccion
        titulo="WhatsApp Cloud API"
        descripcion="Sin estas credenciales Kolek sigue funcionando: los mensajes quedan en cola listos para mandarse a mano. Con ellas, el envío es automático."
        acciones={
          <Button asChild size="sm" variant="outline">
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir Meta for Developers
            </a>
          </Button>
        }
      >
        <div className="space-y-5 rounded-[12px] border border-[#111111]/[0.09] bg-white p-5">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <Badge variant={school.whatsapp_token ? 'pagado' : 'neutral'}>
              {school.whatsapp_token ? 'Conectado' : 'Modo manual'}
            </Badge>
          </div>

          <CampoSecreto
            id="wa-token"
            label="Access token permanente"
            valor={waToken}
            onChange={setWaToken}
            placeholder="EAAG…"
            ayuda="Meta for Developers › tu app › WhatsApp › Configuración de la API. Usa un token de usuario del sistema para que no expire."
          />

          <div className="space-y-1.5">
            <Label htmlFor="wa-phone">Phone number ID</Label>
            <Input
              id="wa-phone"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="123456789012345"
              className="tnum font-mono text-[12px]"
              autoComplete="off"
            />
            <p className="text-[12px] text-muted-foreground">
              No es tu número: es el ID que aparece debajo de él en el panel de Meta.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>URL del webhook (pégala en Meta)</Label>
            <div className="flex gap-2">
              <Input readOnly value={urlWebhook} className="bg-[#111111]/[0.02] font-mono text-[12px]" />
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(urlWebhook);
                  toast.success('URL copiada');
                }}
                aria-label="Copiar URL del webhook"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[12px] text-muted-foreground">
              El token de verificación es el valor de WHATSAPP_VERIFY_TOKEN de tu .env.
            </p>
          </div>

          <Button
            variant="brand"
            loading={g2}
            onClick={async () => {
              setG2(true);
              await onGuardar(
                {
                  whatsapp_token: waToken.trim() || null,
                  whatsapp_phone_number_id: waPhone.trim() || null,
                },
                'WhatsApp actualizado',
              );
              setG2(false);
            }}
          >
            Guardar WhatsApp
          </Button>
        </div>
      </Seccion>
    </div>
  );
}

/* ══ Sección: equipo ═════════════════════════════════════════════════ */

function Equipo({
  equipoInicial,
  miId,
  miRol,
  plan,
}: {
  equipoInicial: Profile[];
  miId: string;
  miRol: string;
  plan: SchoolPlan;
}) {
  const router = useRouter();
  const [equipo, setEquipo] = useState(equipoInicial);
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [enviando, setEnviando] = useState(false);
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null);

  const puedeInvitar = miRol !== 'staff';
  const limite = plan === 'inicio' ? 1 : plan === 'crecimiento' ? 3 : Infinity;

  async function invitar() {
    if (!email.trim() || !nombre.trim()) return toast.error('Falta correo o nombre');
    setEnviando(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), nombre: nombre.trim(), role }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo invitar');
        return;
      }
      setCredenciales({ email: json.email, password: json.password_temporal });
      setEmail('');
      setNombre('');
      router.refresh();
    } catch {
      toast.error('Falló la conexión');
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(p: Profile) {
    const res = await fetch('/api/team/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: p.id }),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error ?? 'No se pudo quitar');
    setEquipo((prev) => prev.filter((x) => x.id !== p.id));
    toast.success(`${p.nombre ?? p.email} ya no tiene acceso`);
  }

  return (
    <Seccion
      titulo="Usuarios del equipo"
      descripcion={`Tu plan incluye ${limite === Infinity ? 'usuarios ilimitados' : `${limite} usuario${limite === 1 ? '' : 's'}`}. Los usuarios ven exactamente los mismos datos de tu escuela y de ninguna otra.`}
      acciones={
        puedeInvitar ? (
          <Button size="sm" variant="brand" onClick={() => setAbierto(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Invitar usuario
          </Button>
        ) : null
      }
    >
      <div className="rounded-[12px] border border-[#111111]/[0.09] bg-white">
        <ul className="divide-y divide-[#111111]/[0.06]">
          {equipo.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">
                  {p.nombre ?? 'Sin nombre'}
                  {p.id === miId && (
                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                      (tú)
                    </span>
                  )}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">{p.email}</p>
              </div>
              <Badge variant={p.role === 'owner' ? 'brand' : 'outline'}>
                {p.role === 'owner' ? 'Dueño' : p.role === 'admin' ? 'Administrador' : 'Staff'}
              </Badge>
              {puedeInvitar && p.id !== miId && p.role !== 'owner' && (
                <Button size="icon-sm" variant="ghost" onClick={() => quitar(p)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="sr-only">Quitar acceso</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          setAbierto(v);
          if (!v) setCredenciales(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar a tu equipo</DialogTitle>
            <DialogDescription>
              Le creamos la cuenta y te damos una contraseña temporal para que se la pases. La
              puede cambiar cuando entre.
            </DialogDescription>
          </DialogHeader>

          {credenciales ? (
            <div className="space-y-4">
              <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-2 text-emerald-800">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  <p className="text-[13px] font-semibold">Cuenta creada</p>
                </div>
                <dl className="mt-4 space-y-2 text-[13px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-emerald-900/70">Correo</dt>
                    <dd className="font-medium text-emerald-900">{credenciales.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-emerald-900/70">Contraseña temporal</dt>
                    <dd className="font-mono font-medium text-emerald-900">
                      {credenciales.password}
                    </dd>
                  </div>
                </dl>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Entra a ${brand.name} con:\nCorreo: ${credenciales.email}\nContraseña: ${credenciales.password}`,
                    );
                    toast.success('Credenciales copiadas');
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar para mandársela
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Esta contraseña no se vuelve a mostrar. Cópiala ahora.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="i-nombre">Nombre</Label>
                <Input
                  id="i-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Laura Pérez"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-email">Correo</Label>
                <Input
                  id="i-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="laura@tuescuela.mx"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-role">Rol</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'staff')}>
                  <SelectTrigger id="i-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff — cobra y consulta</SelectItem>
                    <SelectItem value="admin">Administrador — además invita usuarios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              {credenciales ? 'Listo' : 'Cancelar'}
            </Button>
            {!credenciales && (
              <Button variant="brand" onClick={invitar} loading={enviando}>
                Crear cuenta
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Seccion>
  );
}

/* ══ Sección: plan ═══════════════════════════════════════════════════ */

function PlanActual({
  school,
  suscripcion,
}: {
  school: School;
  suscripcion: Subscription | null;
}) {
  const router = useRouter();
  const actual = PLAN_POR_ID[school.plan];
  const [cambiando, setCambiando] = useState<SchoolPlan | null>(null);

  const ESTADO_LABEL: Record<string, string> = {
    trialing: 'En periodo de prueba',
    active: 'Activa',
    past_due: 'Pago pendiente',
    suspended: 'Suspendida',
    canceled: 'Cancelada',
  };

  async function cambiarPlan(plan: SchoolPlan) {
    setCambiando(plan);
    const res = await fetch('/api/subscription/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, billing_interval: suscripcion?.billing_interval ?? 'monthly' }),
    });
    const json = await res.json().catch(() => ({}));
    setCambiando(null);
    if (!res.ok) return toast.error(json.error ?? 'No se pudo cambiar de plan');
    toast.success(`Plan cambiado a ${PLAN_POR_ID[plan]?.nombre ?? plan}`);
    router.refresh();
  }

  return (
    <Seccion
      titulo="Tu plan"
      descripcion="El precio depende del número de alumnos activos, no del nivel educativo. Puedes cambiarlo cuando quieras."
      acciones={
        <Button asChild size="sm" variant="outline">
          <Link href="/planes">
            <ExternalLink className="h-3.5 w-3.5" />
            Ver comparativa
          </Link>
        </Button>
      }
    >
      {suscripcion && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-[10px] border border-[#111111]/[0.09] bg-[#111111]/[0.02] px-4 py-2.5">
          <Badge variant={suscripcion.status === 'active' || suscripcion.status === 'trialing' ? 'pagado' : 'atrasado'}>
            {ESTADO_LABEL[suscripcion.status] ?? suscripcion.status}
          </Badge>
          {suscripcion.status === 'trialing' && suscripcion.trial_ends_at && (
            <span className="text-[12px] text-muted-foreground">
              Termina el {new Date(suscripcion.trial_ends_at).toLocaleDateString('es-MX')}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {PLANES.map((p) => {
          const activo = p.id === school.plan;
          return (
            <button
              key={p.id}
              type="button"
              disabled={cambiando !== null}
              onClick={() => !activo && cambiarPlan(p.id)}
              className={cn(
                'rounded-[12px] border p-5 text-left transition-all',
                activo
                  ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-500/20'
                  : 'border-[#111111]/[0.09] bg-white hover:border-[#111111]/20',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold tracking-[-0.01em]">{p.nombre}</span>
                {activo && <Badge variant="brand">Actual</Badge>}
              </div>
              <p className="tnum mt-2 text-[22px] font-semibold tracking-[-0.03em]">
                ${p.precio.toLocaleString('es-MX')}
              </p>
              <p className="text-[12px] text-muted-foreground">MXN al mes · {p.gancho}</p>
            </button>
          );
        })}
      </div>

      {actual ? (
        <>
          <Separator className="my-6" />
          <ul className="grid gap-2 sm:grid-cols-2">
            {actual.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13px] text-ink/85">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" strokeWidth={2.6} />
                {f}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Seccion>
  );
}
