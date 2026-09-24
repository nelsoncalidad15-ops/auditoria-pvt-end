import { useEffect, useMemo, useState } from "react";
import {
  User,
  Hash,
  ArrowRight,
  Users,
  Eye,
  Printer,
  Pencil,
  Search,
  CheckCircle2,
  Car,
  PlusCircle,
  Target,
  PauseCircle,
  Flag,
  FileDown,
  MoreHorizontal,
} from "lucide-react";
import { AuditSession } from "../../types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

interface AuditStaffSelectionViewProps {
  role: string;
  staffList: string[];
  selectedStaff: string;
  onSelectStaff: (staffName: string) => void;
  orderNumber?: string;
  onOrderNumberChange?: (value: string) => void;
  clientIdentifier?: string;
  onClientIdentifierChange?: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  isOrdersAudit: boolean;
  isServiceAdvisorAudit: boolean;
  isTechnicianAudit: boolean;
  staffProgress?: { advisorName: string; sampledCount: number }[];
  sampleTarget?: number;
  selectedStaffNames?: string[];
  onSampleTargetChange?: (value: number) => void;
  onSelectedStaffNamesChange?: (names: string[]) => void;
  orderAudits?: AuditSession[];
  onViewOrderAudit?: (audit: AuditSession) => void;
  onEditOrderAudit?: (audit: AuditSession) => void;
  onPrintOrderAudit?: (audit: AuditSession) => void;
  onSaveOrdersCampaign?: () => void;
  onFinishOrdersCampaign?: () => void;
  onPrintOrdersCampaign?: () => void;
  onOpenPhysicalStockControl?: () => void;
}

export function AuditStaffSelectionView({
  role,
  staffList,
  selectedStaff,
  onSelectStaff,
  orderNumber,
  onOrderNumberChange,
  clientIdentifier,
  onClientIdentifierChange,
  onContinue,
  onBack,
  isOrdersAudit,
  isServiceAdvisorAudit,
  isTechnicianAudit,
  staffProgress,
  sampleTarget = 30,
  selectedStaffNames = [],
  onSampleTargetChange,
  onSelectedStaffNamesChange,
  orderAudits = [],
  onViewOrderAudit,
  onEditOrderAudit,
  onPrintOrderAudit,
  onSaveOrdersCampaign,
  onFinishOrdersCampaign,
  onPrintOrdersCampaign,
  onOpenPhysicalStockControl,
}: AuditStaffSelectionViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [manualStaffName, setManualStaffName] = useState("");
  const [isCampaignEditing, setIsCampaignEditing] = useState(selectedStaffNames.length === 0);

  const availableStaff = isOrdersAudit && selectedStaffNames.length > 0 ? selectedStaffNames : staffList;
  const filteredStaff = availableStaff.filter((name) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const orderAuditsByAdvisor = useMemo(() => {
    const groups = new Map<string, AuditSession[]>();
    orderAudits.forEach((audit) => {
      const advisor = audit.staffName?.trim() || audit.participants?.asesorServicio?.trim() || "Sin asesor asignado";
      const current = groups.get(advisor) ?? [];
      current.push(audit);
      groups.set(advisor, current);
    });

    return Array.from(groups.entries())
      .map(([advisor, audits]) => [advisor, [...audits].sort((left, right) => `${right.date}-${right.id}`.localeCompare(`${left.date}-${left.id}`))] as const)
      .sort(([left], [right]) => left.localeCompare(right));
  }, [orderAudits]);

  const isOtherRole = !isOrdersAudit && !isServiceAdvisorAudit && !isTechnicianAudit;
  const isManualSelection = selectedStaff.trim() !== "" && !staffList.includes(selectedStaff);

  useEffect(() => {
    setManualStaffName(isManualSelection ? selectedStaff : "");
  }, [isManualSelection, selectedStaff]);

  const hasValidOrderNumber = Boolean(orderNumber && /^\d{2,10}$/.test(orderNumber));
  const hasClientIdentifier = Boolean(clientIdentifier?.trim());
  const isCampaignComplete = isOrdersAudit && orderAudits.length >= sampleTarget;
  const campaignProgress = Math.min(100, Math.round((orderAudits.length / Math.max(sampleTarget, 1)) * 100));

  const canContinue = selectedStaff.trim() !== "" && (
    (isOrdersAudit && hasValidOrderNumber) ||
    (isServiceAdvisorAudit && hasValidOrderNumber && hasClientIdentifier) ||
    isTechnicianAudit ||
    isOtherRole
  );

  const toggleCampaignStaff = (name: string) => {
    const next = selectedStaffNames.includes(name)
      ? selectedStaffNames.filter((item) => item !== name)
      : [...selectedStaffNames, name];
    onSelectedStaffNamesChange?.(next);
    if (selectedStaff === name && !next.includes(name)) onSelectStaff("");
  };

  const finishCampaignSetup = () => {
    if (selectedStaffNames.length === 0) return;
    if (!selectedStaffNames.includes(selectedStaff)) onSelectStaff(selectedStaffNames[0]);
    setIsCampaignEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 shadow-sm">
              <div className="h-2 w-2 rounded-full bg-blue-600" />
              Configuracion de auditoria
            </span>
            <h2 className="text-xl font-black tracking-tight text-slate-950">{role}</h2>
          </div>

          <Button variant="secondary" onClick={onBack} className="w-fit">
            Volver a areas
          </Button>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-4", isOrdersAudit && isCampaignEditing ? "mx-auto max-w-3xl" : "lg:grid-cols-[1fr_330px]")}>
        <div className="space-y-4">
          {isOrdersAudit && (
            <section className="premium-card border-slate-200 bg-white p-4 shadow-sm">
              <div className={cn("flex items-center gap-3", isCampaignEditing && "mb-4")}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Target className="h-4 w-4" /></span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Campaña de OR</p>
                  <h3 className="text-base font-black text-slate-900">Objetivo y asesores</h3>
                </div>
                <span className={cn("ml-auto rounded-full px-3 py-1 text-[10px] font-black", isCampaignComplete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{orderAudits.length}/{sampleTarget} OR</span>
                {!isCampaignEditing && <button type="button" onClick={() => setIsCampaignEditing(true)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:border-blue-300">Editar configuración</button>}
              </div>
              {isCampaignEditing ? <>
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex-1 space-y-2"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Cantidad de OR a auditar</span><input aria-label="Cantidad de OR a auditar" type="number" min={1} max={1000} value={sampleTarget} onChange={(event) => onSampleTargetChange?.(Math.max(1, Number(event.target.value) || 1))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 outline-none focus:border-blue-400" /></label>
                <div className="flex gap-2">{[10, 20, 30].map((target) => <button key={target} type="button" onClick={() => onSampleTargetChange?.(target)} className={cn("h-11 rounded-xl border px-3 text-[10px] font-black transition", sampleTarget === target ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-blue-300")}>{target}</button>)}</div>
              </div>

              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Personas que participan de la campaña</p>
              <div className="flex flex-wrap gap-2">
                {selectedStaffNames.map((name) => (
                  <button key={name} type="button" onClick={() => toggleCampaignStaff(name)} className="rounded-full border border-blue-600 bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-800">✓ {name} <span className="ml-1 text-blue-400">×</span></button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input type="text" value={manualStaffName} onChange={(event) => setManualStaffName(event.target.value)} placeholder="Agregar colaborador…"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none focus:border-blue-400" />
                <button type="button" onClick={() => {
                  const name = manualStaffName.trim();
                  if (!name) return;
                  if (!selectedStaffNames.includes(name)) onSelectedStaffNamesChange?.([...selectedStaffNames, name]);
                  onSelectStaff(name);
                  setManualStaffName("");
                }} className="h-9 rounded-lg bg-slate-900 px-3 text-[9px] font-black uppercase tracking-wider text-white">Agregar</button>
              </div>
              {staffList.some((name) => !selectedStaffNames.includes(name)) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[9px] font-bold text-slate-400">Sugeridos:</span>{staffList.filter((name) => !selectedStaffNames.includes(name)).map((name) => (
                  <button key={name} type="button" onClick={() => { onSelectedStaffNamesChange?.([...selectedStaffNames, name]); onSelectStaff(name); }} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[9px] font-bold text-slate-600">+ {name}</button>
                ))}</div>
              )}
              {selectedStaffNames.length === 0 && <p className="mt-3 text-[10px] font-medium text-amber-700">Seleccioná al menos un asesor para agilizar la carga.</p>}
              <button type="button" disabled={selectedStaffNames.length === 0} onClick={finishCampaignSetup} className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Guardar configuración y continuar</button>
              </> : (
                <p className="mt-2 truncate text-[10px] font-medium text-slate-500">{selectedStaffNames.length ? selectedStaffNames.join(" · ") : "Todos los asesores"}</p>
              )}
              {!isCampaignEditing && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn("h-full rounded-full transition-all", isCampaignComplete ? "bg-emerald-500" : "bg-blue-600")} style={{ width: `${campaignProgress}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-bold">
                    <span className={isCampaignComplete ? "text-emerald-700" : "text-slate-500"}>{isCampaignComplete ? "Objetivo cumplido. La campaña está lista para cerrar." : `Faltan ${Math.max(sampleTarget - orderAudits.length, 0)} OR para completar el objetivo.`}</span>
                    <span className="shrink-0 text-slate-400">{campaignProgress}%</span>
                  </div>
                </div>
              )}
            </section>
          )}

          {!isOrdersAudit && <div className="premium-card border-white/5 bg-white p-5 shadow-sm dark:bg-slate-900">
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Selecciona al colaborador</h3>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStaff.map((name) => {
                const progress = staffProgress?.find((entry) => entry.advisorName === name);
                return (
                  <button
                    type="button"
                    key={name}
                    onClick={() => {
                      setManualStaffName("");
                      onSelectStaff(name);
                    }}
                    className={cn(
                      "group relative flex items-center justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all",
                      selectedStaff === name
                        ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "border-slate-100 bg-white text-slate-900 hover:border-blue-300 dark:border-white/5 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/30"
                    )}
                  >
                    <div className="relative z-10 flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        selectedStaff === name ? "bg-white/20" : "bg-slate-100 dark:bg-white/5"
                      )}>
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black uppercase tracking-tight">{name}</span>
                        {progress ? (
                          <span className={cn(
                            "mt-1 text-[9px] font-black uppercase tracking-widest",
                            selectedStaff === name ? "text-blue-100" : "text-slate-400"
                          )}>
                            {progress.sampledCount} {isOrdersAudit ? "ORs" : "Clientes"} completados
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-2">
                      {progress ? (
                        <div className={cn(
                          "rounded-lg px-2 py-0.5 text-[9px] font-black",
                          selectedStaff === name
                            ? "bg-white/20 text-white"
                            : progress.sampledCount >= (isOrdersAudit ? sampleTarget : 2)
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-blue-500/10 text-blue-500"
                        )}>
                          {progress.sampledCount}{isOrdersAudit ? " OR" : "/2"}
                        </div>
                      ) : null}
                      {selectedStaff === name ? <CheckCircle2 className="h-5 w-5 text-white" /> : null}
                    </div>
                  </button>
                );
              })}

              <div className={cn(
                "flex flex-col space-y-3 rounded-2xl border p-4 transition-all",
                isManualSelection
                  ? "border-blue-600/30 bg-blue-600/5"
                  : "border-dashed border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5"
              )}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-500 dark:bg-white/10">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Otro manual</span>
                </div>
                <input
                  type="text"
                  placeholder="Ingresar nombre manualmente..."
                  value={manualStaffName}
                  onChange={(e) => {
                    setManualStaffName(e.target.value);
                    onSelectStaff(e.target.value);
                  }}
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>}
          {isOrdersAudit && !isCampaignEditing && (
            <section className="premium-card overflow-hidden border-slate-200 bg-white shadow-xl dark:border-white/5 dark:bg-slate-900">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Control de ciclo</p>
                  <h3 className="mt-1 text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">OR auditadas</h3>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {orderAudits.length} registro{orderAudits.length === 1 ? "" : "s"}
                </span>
              </div>

              {orderAuditsByAdvisor.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">Todavia no hay OR auditadas en este ciclo.</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">Carga la primera OR desde el panel de la derecha.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {orderAuditsByAdvisor.map(([advisor, audits]) => (
                    <div key={advisor} className="p-4 sm:p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <User className="h-4 w-4 shrink-0 text-blue-500" />
                          <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{advisor}</p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{audits.length} OR</span>
                      </div>
                      <div className="space-y-2">
                        {audits.map((audit) => {
                          const deviations = audit.items.filter((item) => item.status === "fail").length;
                          return (
                            <article key={audit.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-white/5">
                              <button type="button" onClick={() => onViewOrderAudit?.(audit)} className="min-w-0 flex-1 text-left">
                                <p className="text-sm font-black text-slate-800 dark:text-slate-100">OR {audit.orderNumber || "Sin numero"}</p>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                  {audit.date} ? {audit.totalScore}%{deviations > 0 ? ` ? ${deviations} desvio${deviations === 1 ? "" : "s"}` : " ? Sin desvios"}
                                </p>
                              </button>
                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                <button type="button" onClick={() => onViewOrderAudit?.(audit)} title="Ver auditoria" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-200">
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => onEditOrderAudit?.(audit)} title="Editar OR" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 transition hover:bg-amber-50 hover:text-amber-600 dark:bg-slate-800 dark:text-slate-200">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => onPrintOrderAudit?.(audit)} title="Descargar PDF" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-700">
                                  <Printer className="h-4 w-4" />
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

        </div>

        <aside className={cn("space-y-4", isOrdersAudit && isCampaignEditing && "hidden")}>
          {role === "Repuestos" && onOpenPhysicalStockControl && (
            <button type="button" onClick={onOpenPhysicalStockControl} className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
              <p className="text-[10px] font-black uppercase tracking-widest">Auditoría de Repuestos</p>
              <p className="mt-1 text-sm font-black">Ir al control físico de ubicación y cantidad</p>
              <p className="mt-1 text-xs font-medium opacity-80">Es una subauditoría de Repuestos; no aparece como área independiente.</p>
            </button>
          )}
          <div className="premium-card space-y-4 border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
            <div className="flex items-center justify-between">
              <p className={cn("text-[9px] font-black uppercase tracking-[0.18em]", isCampaignComplete ? "text-emerald-600" : "text-blue-600")}>{isCampaignComplete ? "Campaña completa" : "Nueva OR"}</p>
              {isOrdersAudit && <span className="text-[9px] font-bold text-slate-400">{isCampaignComplete ? `${orderAudits.length} de ${sampleTarget}` : `OR ${orderAudits.length + 1} de ${sampleTarget}`}</span>}
            </div>

            {isCampaignComplete && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white"><CheckCircle2 className="h-5 w-5" /></span>
                  <div><p className="text-sm font-black text-emerald-900">Objetivo cumplido</p><p className="mt-1 text-[11px] font-medium leading-relaxed text-emerald-700">Ya auditaste las {sampleTarget} OR previstas. Podés cerrar la campaña o descargar el informe.</p></div>
                </div>
              </div>
            )}

            {isOrdersAudit && !isCampaignComplete && (
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Responsable de esta OR</label>
                <select value={selectedStaff} onChange={(event) => onSelectStaff(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-[#001e50] outline-none focus:border-blue-400">
                  <option value="">Elegir asesor</option>
                  {availableStaff.map((name) => {
                    const count = staffProgress?.find((entry) => entry.advisorName === name)?.sampledCount || 0;
                    return <option key={name} value={name}>{name} · {count} OR</option>;
                  })}
                </select>
              </div>
            )}

            {((isOrdersAudit && !isCampaignComplete) || isServiceAdvisorAudit) ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <Hash className="h-3 w-3" />
                    Numero de OR
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={orderNumber || ""}
                    onChange={(e) => onOrderNumberChange?.(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ej: 123456"
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-base font-black tracking-[0.16em] text-[#001e50] outline-none focus:border-blue-400"
                  />
                </div>
                {isOrdersAudit ? (
                  <div className="rounded-lg bg-blue-50 px-3 py-2">
                    <p className="text-[9px] font-bold text-blue-700">Se conserva la campaña al pasar a la próxima OR.</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isServiceAdvisorAudit ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <Car className="h-3 w-3" />
                  Nombre de cliente o VIN
                </label>
                <input
                  type="text"
                  value={clientIdentifier || ""}
                  onChange={(e) => onClientIdentifierChange?.(e.target.value)}
                  placeholder="Identificador de la unidad..."
                  autoComplete="off"
                  className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            ) : null}

            {isTechnicianAudit ? (
              <div className="rounded-2xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                <p className="text-[10px] font-bold text-slate-400">Auditoria tecnica de proceso y calidad de reparacion.</p>
              </div>
            ) : null}

            {!isCampaignComplete && <div className="pt-1">
              <Button
                size="lg"
                className="h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-[0.16em]"
                disabled={!canContinue}
                onClick={onContinue}
              >
                <span>Comenzar OR</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              {!canContinue ? (
                <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-rose-500 animate-pulse">
                  Faltan datos obligatorios
                </p>
              ) : null}
            </div>}

            {isOrdersAudit && orderAudits.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                {isCampaignComplete ? (
                  <>
                    <button type="button" onClick={onFinishOrdersCampaign} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-emerald-700"><Flag className="h-4 w-4" /> Finalizar campaña</button>
                    <button type="button" onClick={onPrintOrdersCampaign} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"><FileDown className="h-4 w-4" /> Descargar PDF</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={onSaveOrdersCampaign} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-500 transition hover:bg-slate-100"><PauseCircle className="h-4 w-4" /> Guardar y salir</button>
                    <details className="group rounded-xl border border-slate-200 bg-white">
                      <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500"><MoreHorizontal className="h-4 w-4" /> Más acciones</summary>
                      <div className="space-y-1 border-t border-slate-100 p-2">
                        <button type="button" onClick={onPrintOrdersCampaign} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50"><FileDown className="h-4 w-4" /> Descargar avance en PDF</button>
                        <button type="button" onClick={onFinishOrdersCampaign} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[10px] font-bold text-rose-600 hover:bg-rose-50"><Flag className="h-4 w-4" /> Finalizar antes del objetivo</button>
                      </div>
                    </details>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={cn("premium-card border-slate-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-slate-900", isOrdersAudit && "hidden")}>
            <h4 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Ayuda rapida</h4>
            <ul className="space-y-3">
              <li className="flex gap-2 text-[11px] font-medium leading-tight text-slate-600 dark:text-slate-400">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                Para {role}, es fundamental identificar correctamente al responsable.
              </li>
              <li className="flex gap-2 text-[11px] font-medium leading-tight text-slate-600 dark:text-slate-400">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                Los resultados impactaran en el score mensual del colaborador.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
