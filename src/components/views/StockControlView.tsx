import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardCheck,
  FileSpreadsheet,
  Loader2,
  MapPin,
  PackageCheck,
  Plus,
  Save,
  Shuffle,
  Trash2,
  Upload,
} from "lucide-react";
import { cn, createClientId } from "../../lib/utils";
import { AuditItem, AuditSession, AuditTemplateItem, Location } from "../../types";
import { buildAuditSyncPayload, sendStockControlToWebhook, StockControlSheetRow } from "../../services/audit-sync";

type ControlMode = "excel" | "manual";

type ImportedStockRow = {
  location: string;
  line: string;
  article: string;
  description: string;
  systemStock: number;
};

type ControlRow = ImportedStockRow & {
  id: string;
  locationCheck: boolean | null;
  quantityCheck: boolean | null;
  observedLocation: string;
  physicalQuantity: string;
  comment: string;
};

type ManualDraft = {
  location: string;
  line: string;
  article: string;
  description: string;
  systemStock: string;
  observedLocation: string;
  physicalQuantity: string;
};

const EMPTY_MANUAL_DRAFT: ManualDraft = {
  location: "",
  line: "",
  article: "",
  description: "",
  systemStock: "",
  observedLocation: "",
  physicalQuantity: "",
};

const STOCK_LOCATION_ITEM_ID = "repuestos-1";
const STOCK_QUANTITY_ITEM_ID = "repuestos-2";

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeLocation(value: string) {
  return value
    .trim()
    .toLocaleUpperCase("es-AR")
    .replace(/\s+/g, "")
    .replace(/[-_./]+/g, "");
}

function parseStock(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toControlRow(row: ImportedStockRow): ControlRow {
  return {
    ...row,
    id: createClientId(),
    locationCheck: null,
    quantityCheck: null,
    observedLocation: "",
    physicalQuantity: "",
    comment: "",
  };
}

function sampleRows(rows: ImportedStockRow[], quantity: number) {
  const shuffled = [...rows];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled.slice(0, Math.min(Math.max(1, quantity), shuffled.length)).map(toControlRow);
}

function resolveColumns(rawRows: unknown[][]) {
  const headerRowIndex = rawRows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.some((header) => header.includes("articulo"))
      && headers.some((header) => header.includes("descripcion"))
      && headers.some((header) => header.includes("stock"));
  });

  if (headerRowIndex < 0) {
    throw new Error("No encontré los encabezados Artículo, Descripción y Stock en el Excel.");
  }

  const headers = rawRows[headerRowIndex].map(normalizeHeader);
  const findColumn = (matcher: (header: string) => boolean) => headers.findIndex(matcher);
  const location = findColumn((header) => header.includes("locacion") || header.includes("ubicacion"));
  const line = findColumn((header) => header === "linea" || header.includes("linea"));
  const article = findColumn((header) => header.includes("articulo"));
  const description = findColumn((header) => header.includes("descripcion"));
  const stock = findColumn((header) => header.includes("stock"));

  if (article < 0 || description < 0 || stock < 0) {
    throw new Error("El archivo debe incluir Artículo, Descripción y Stock.");
  }

  return {
    headerRowIndex,
    location: location >= 0 ? location : 0,
    line,
    article,
    description,
    stock,
  };
}

function scoreLabel(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

interface StockAuditQuestionProps {
  label: string;
  question: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}

function StockAuditQuestion({ label, question, value, onChange }: StockAuditQuestionProps) {
  const statusLabel = value === true ? "Sí" : value === false ? "No" : "Pendiente";

  return (
    <div className={cn(
      "rounded-[1.4rem] border p-4 transition-colors md:p-5",
      value === true
        ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20"
        : value === false
          ? "border-red-300 bg-red-50/70 dark:border-red-800 dark:bg-red-950/20"
          : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950",
    )}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-sm font-black leading-snug text-slate-900 dark:text-white">{question}</p>
        </div>
        <span className={cn(
          "w-fit shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
          value === true
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
            : value === false
              ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
              : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-300",
        )}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          aria-pressed={value === true}
          onClick={() => onChange(true)}
          className={cn(
            "rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition active:scale-[0.98]",
            value === true
              ? "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
          )}
        >
          Sí
        </button>
        <button
          type="button"
          aria-pressed={value === false}
          onClick={() => onChange(false)}
          className={cn(
            "rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition active:scale-[0.98]",
            value === false
              ? "border-red-500 bg-red-500 text-white shadow-lg shadow-red-500/20"
              : "border-slate-200 bg-white text-slate-600 hover:border-red-400 hover:text-red-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
          )}
        >
          No
        </button>
      </div>
    </div>
  );
}
interface StockControlViewProps {
  auditors: Array<{ id: string; name: string }>;
  defaultAuditorId?: string;
  defaultLocation?: Location;
  defaultBatchName?: string;
  defaultDate?: string;
  webhookUrl: string;
  onSaved: (audit: AuditSession) => void;
  onBack?: () => void;
}

export function StockControlView({
  auditors,
  defaultAuditorId = "",
  defaultLocation = "Jujuy",
  defaultBatchName = "",
  defaultDate,
  webhookUrl,
  onSaved,
  onBack,
}: StockControlViewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<ControlMode>("excel");
  const [importedRows, setImportedRows] = useState<ImportedStockRow[]>([]);
  const [rows, setRows] = useState<ControlRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [sampleSize, setSampleSize] = useState(10);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(EMPTY_MANUAL_DRAFT);
  const [location, setLocation] = useState<Location>(defaultLocation);
  const [auditorId, setAuditorId] = useState(defaultAuditorId);
  const [auditDate, setAuditDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [auditBatchName, setAuditBatchName] = useState(defaultBatchName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);

  const locationScore = useMemo(() => {
    const answered = rows.filter((row) => row.locationCheck !== null);
    return answered.length > 0 ? (answered.filter((row) => row.locationCheck).length / answered.length) * 100 : 0;
  }, [rows]);
  const quantityScore = useMemo(() => {
    const answered = rows.filter((row) => row.quantityCheck !== null);
    return answered.length > 0 ? (answered.filter((row) => row.quantityCheck).length / answered.length) * 100 : 0;
  }, [rows]);
  const totalScore = rows.length > 0 ? (locationScore + quantityScore) / 2 : 0;
  const pendingCount = rows.filter((row) => row.locationCheck === null || row.quantityCheck === null).length;
  const deviations = rows.filter((row) => row.locationCheck === false || row.quantityCheck === false);
  const missingDeviationComments = deviations.filter((row) => !row.comment.trim());

  const updateRow = (id: string, patch: Partial<ControlRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const handleExcel = async (file: File) => {
    try {
      if (!/\.(xls|xlsx|csv)$/i.test(file.name)) {
        throw new Error("El archivo debe ser Excel (.xls, .xlsx) o CSV.");
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("El archivo supera el máximo permitido de 10 MB.");
      }
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) throw new Error("No encontré una hoja utilizable en el archivo.");

      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
      if (rawRows.length > 20001) {
        throw new Error("El archivo supera el límite de 20.000 filas para este control.");
      }
      const columns = resolveColumns(rawRows);
      const parsedRows = rawRows.slice(columns.headerRowIndex + 1).flatMap((row): ImportedStockRow[] => {
        const article = String(row[columns.article] ?? "").trim();
        const itemLocation = String(row[columns.location] ?? "").trim();
        const stock = parseStock(row[columns.stock]);
        if (!article || !itemLocation || !Number.isFinite(stock)) return [];
        return [{
          location: itemLocation,
          line: columns.line >= 0 ? String(row[columns.line] ?? "").trim() : "",
          article,
          description: String(row[columns.description] ?? "").trim(),
          systemStock: stock,
        }];
      });

      if (parsedRows.length === 0) {
        throw new Error("No encontré filas válidas con Locación, Artículo y Stock.");
      }

      setImportedRows(parsedRows);
      setRows(sampleRows(parsedRows, sampleSize));
      setFileName(file.name);
      setNotice({ tone: "success", text: `${parsedRows.length} registros leídos. Se seleccionaron ${Math.min(sampleSize, parsedRows.length)} ítems al azar.` });
    } catch (error) {
      setImportedRows([]);
      setRows([]);
      setFileName("");
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo leer el Excel." });
    }
  };

  const selectAnotherSample = () => {
    if (importedRows.length === 0) return;
    setRows(sampleRows(importedRows, sampleSize));
    setNotice({ tone: "info", text: `Nueva muestra de ${Math.min(sampleSize, importedRows.length)} ítems seleccionada.` });
  };

  const addManualItem = () => {
    const systemStock = parseStock(manualDraft.systemStock);
    if (!manualDraft.location.trim() || !manualDraft.article.trim() || !Number.isFinite(systemStock)) {
      setNotice({ tone: "error", text: "Para agregar un ítem manual necesitás Locación, Artículo y Stock de sistema." });
      return;
    }

    const observedQuantity = parseStock(manualDraft.physicalQuantity);
    setRows((current) => [...current, {
      id: createClientId(),
      location: manualDraft.location.trim(),
      line: manualDraft.line.trim(),
      article: manualDraft.article.trim(),
      description: manualDraft.description.trim(),
      systemStock,
      observedLocation: manualDraft.observedLocation.trim(),
      physicalQuantity: manualDraft.physicalQuantity.trim(),
      locationCheck: manualDraft.observedLocation.trim()
        ? normalizeLocation(manualDraft.observedLocation) === normalizeLocation(manualDraft.location)
        : null,
      quantityCheck: manualDraft.physicalQuantity.trim()
        ? Number.isFinite(observedQuantity) && observedQuantity === systemStock
        : null,
      comment: "",
    }]);
    setManualDraft(EMPTY_MANUAL_DRAFT);
    setNotice(null);
  };

  const saveControl = async () => {
    if (!auditorId) {
      setNotice({ tone: "error", text: "Seleccioná el auditor responsable antes de guardar el control." });
      return;
    }
    if (!auditBatchName.trim()) {
      setNotice({ tone: "error", text: "Definí el ciclo mensual antes de guardar el control." });
      return;
    }
    if (!webhookUrl.trim()) {
      setNotice({ tone: "error", text: "Falta configurar la URL de Google Sheets antes de guardar el control." });
      return;
    }
    if (rows.length === 0) {
      setNotice({ tone: "error", text: "Agregá o importá al menos un ítem para controlar." });
      return;
    }
    if (pendingCount > 0) {
      setNotice({ tone: "error", text: `Quedan ${pendingCount} ítems sin validar ubicación y/o cantidad.` });
      return;
    }
    if (missingDeviationComments.length > 0) {
      setNotice({ tone: "error", text: "Cada desvío necesita una observación antes de guardar." });
      return;
    }

    const auditorName = auditors.find((auditor) => auditor.id === auditorId)?.name || "Auditor de calidad";
    const summaryItems: AuditItem[] = [
      {
        id: STOCK_LOCATION_ITEM_ID,
        question: "Resultado control físico - Ubicación",
        category: "Repuestos",
        status: "calculated",
        calculatedScore: Number(locationScore.toFixed(1)),
        calculationState: "complete",
        calculationDetail: `${rows.filter((row) => row.locationCheck).length} de ${rows.length} locaciones correctas`,
        weight: 1,
        allowsNa: false,
      },
      {
        id: STOCK_QUANTITY_ITEM_ID,
        question: "Resultado control físico - Cantidad",
        category: "Repuestos",
        status: "calculated",
        calculatedScore: Number(quantityScore.toFixed(1)),
        calculationState: "complete",
        calculationDetail: `${rows.filter((row) => row.quantityCheck).length} de ${rows.length} cantidades correctas`,
        weight: 1,
        allowsNa: false,
      },
    ];
    const stockRows: StockControlSheetRow[] = rows.map((row) => ({
      source: mode === "excel" ? "Importación de Excel" : "Carga manual",
      systemLocation: row.location,
      line: row.line,
      article: row.article,
      description: row.description,
      systemStock: row.systemStock,
      locationResult: row.locationCheck ? "si" : "no",
      quantityResult: row.quantityCheck ? "si" : "no",
      observedLocation: row.observedLocation,
      physicalQuantity: row.physicalQuantity,
      comment: row.comment,
    }));
    const items = summaryItems;
    const templateItems: AuditTemplateItem[] = items.map((item, index) => ({
      id: item.id,
      text: item.question,
      required: true,
      allowsNa: false,
      weight: item.weight,
      order: index + 1,
      active: true,
    }));
    const audit: AuditSession = {
      id: createClientId(),
      date: auditDate,
      auditBatchName: auditBatchName.trim(),
      auditorId,
      location,
      staffName: "Repuestos",
      role: "Repuestos",
      items,
      totalScore: Number(totalScore.toFixed(1)),
      notes: `Origen: ${mode === "excel" ? "Importación de Excel" : "Carga manual"}. Muestra: ${rows.length} ítems.`,
      entityType: "general",
    };

    setIsSubmitting(true);
    try {
      const payload = buildAuditSyncPayload({ templateItems, session: audit, auditorName });
      await sendStockControlToWebhook(webhookUrl.trim(), { ...payload, event: "stock_control_submit", stockRows });
      onSaved(audit);
      setNotice({ tone: "success", text: `Control guardado: ubicación ${scoreLabel(locationScore)} · cantidad ${scoreLabel(quantityScore)}.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo guardar el control en Sheets." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
              <PackageCheck className="h-3.5 w-3.5" /> Repuestos
            </div>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Control físico de Repuestos</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Validá ubicación y cantidad contra el stock de sistema. El resultado queda detallado por artículo y alimenta los dos controles de Repuestos.
            </p>
            {onBack && (
              <button type="button" onClick={onBack} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-white/10">
                <ArrowLeft className="h-3.5 w-3.5" /> Volver a Repuestos
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Ubicación", scoreLabel(locationScore), "text-emerald-300"],
              ["Cantidad", scoreLabel(quantityScore), "text-cyan-300"],
              ["Muestra", String(rows.length), "text-white"],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className={cn("mt-1 text-lg font-black", tone)}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Fecha
          <input type="date" value={auditDate} onChange={(event) => setAuditDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Sucursal
          <select value={location} onChange={(event) => setLocation(event.target.value as Location)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="Jujuy">Jujuy</option><option value="Salta">Salta</option>
          </select>
        </label>
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Auditor
          <select value={auditorId} onChange={(event) => setAuditorId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="">Seleccionar</option>{auditors.map((auditor) => <option key={auditor.id} value={auditor.id}>{auditor.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Ciclo mensual
          <input value={auditBatchName} onChange={(event) => setAuditBatchName(event.target.value)} placeholder="Ej.: Junio 2026" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
      </section>

      <section className="rounded-[1.6rem] border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode("excel")} className={cn("flex items-center justify-center gap-2 rounded-[1.1rem] px-4 py-3 text-xs font-black uppercase tracking-[0.14em]", mode === "excel" ? "bg-slate-950 text-white dark:bg-emerald-400 dark:text-slate-950" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}><FileSpreadsheet className="h-4 w-4" />Desde Excel</button>
          <button type="button" onClick={() => setMode("manual")} className={cn("flex items-center justify-center gap-2 rounded-[1.1rem] px-4 py-3 text-xs font-black uppercase tracking-[0.14em]", mode === "manual" ? "bg-slate-950 text-white dark:bg-emerald-400 dark:text-slate-950" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}><ClipboardCheck className="h-4 w-4" />Uno por uno</button>
        </div>
      </section>

      {mode === "excel" ? (
        <section className="rounded-[1.8rem] border border-dashed border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <input ref={inputRef} type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleExcel(file);
            event.target.value = "";
          }} />
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600"><Upload className="h-6 w-6" /></div>
              <div><h2 className="font-black text-slate-950 dark:text-white">Archivo de stock del sistema</h2><p className="mt-1 text-sm text-slate-500">Lee: Locación, Línea, Artículo, Descripción y Stock. El archivo no se almacena; solo se guarda el resultado auditado.</p>{fileName && <p className="mt-2 text-xs font-black text-emerald-600">{fileName} · {importedRows.length} registros</p>}</div>
            </div>
            <div className="flex flex-wrap items-end gap-3"><label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ítems a revisar<input type="number" min="1" max={Math.max(importedRows.length, 1)} value={sampleSize} onChange={(event) => setSampleSize(Math.max(1, Number(event.target.value) || 1))} className="mt-1 block w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wider text-white dark:bg-emerald-400 dark:text-slate-950"><Upload className="h-4 w-4" />Subir Excel</button>{importedRows.length > 0 && <button type="button" onClick={selectAnotherSample} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:text-slate-200"><Shuffle className="h-4 w-4" />Nueva muestra</button>}</div>
          </div>
        </section>
      ) : (
        <section className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5"><h2 className="font-black text-slate-950 dark:text-white">Carga y control uno por uno</h2><p className="mt-1 text-sm text-slate-500">Ingresá los datos del sistema y lo observado físicamente. La coincidencia se calcula sola.</p></div>
          <div className="grid gap-3 md:grid-cols-4"><input value={manualDraft.location} onChange={(event) => setManualDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Locación sistema" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-950" /><input value={manualDraft.article} onChange={(event) => setManualDraft((current) => ({ ...current, article: event.target.value }))} placeholder="Artículo" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-950" /><input value={manualDraft.description} onChange={(event) => setManualDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Descripción" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-950" /><input value={manualDraft.systemStock} onChange={(event) => setManualDraft((current) => ({ ...current, systemStock: event.target.value }))} placeholder="Stock sistema" inputMode="decimal" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-950" /><input value={manualDraft.observedLocation} onChange={(event) => setManualDraft((current) => ({ ...current, observedLocation: event.target.value }))} placeholder="Locación física" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-950" /><input value={manualDraft.physicalQuantity} onChange={(event) => setManualDraft((current) => ({ ...current, physicalQuantity: event.target.value }))} placeholder="Cantidad física" inputMode="decimal" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-950" /><input value={manualDraft.line} onChange={(event) => setManualDraft((current) => ({ ...current, line: event.target.value }))} placeholder="Línea (opcional)" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-950" /><button type="button" onClick={addManualItem} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white dark:bg-emerald-400 dark:text-slate-950"><Plus className="h-4 w-4" />Agregar</button></div>
        </section>
      )}

      {notice && <div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold", notice.tone === "error" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" : notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300")}>{notice.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}{notice.text}</div>}

      {rows.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="font-black text-slate-950 dark:text-white">Auditoría de la muestra</h2>
              <p className="mt-1 text-sm text-slate-500">
                Revisá cada artículo y respondé Sí o No para locación y cantidad.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {rows.reduce((total, row) => total + Number(row.locationCheck !== null) + Number(row.quantityCheck !== null), 0)} de {rows.length * 2} respuestas
              </p>
              <p className={cn(
                "rounded-full px-3 py-1.5 text-xs font-black",
                deviations.length > 0 ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
              )}>
                {deviations.length} desvíos
              </p>
            </div>
          </div>

          {rows.map((row, index) => {
            const needsComment = row.locationCheck === false || row.quantityCheck === false;
            const isComplete = row.locationCheck !== null && row.quantityCheck !== null;

            return (
              <article
                id={`stock-item-${row.id}`}
                key={row.id}
                className={cn(
                  "overflow-hidden rounded-[1.8rem] border bg-white shadow-sm transition-colors dark:bg-slate-900",
                  needsComment
                    ? "border-red-300 dark:border-red-900/60"
                    : isComplete
                      ? "border-emerald-300 dark:border-emerald-900/60"
                      : "border-slate-200 dark:border-slate-800",
                )}
              >
                <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Artículo {index + 1} de {rows.length}
                      </span>
                      <span className="font-black text-slate-950 dark:text-white">{row.article}</span>
                      {row.line && <span className="text-xs font-bold text-slate-400">Línea {row.line}</span>}
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">{row.description || "Sin descripción"}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 shadow-sm dark:bg-slate-900">
                        <MapPin className="h-3.5 w-3.5" /> Locación sistema: {row.location}
                      </span>
                      <span className="rounded-lg bg-white px-2 py-1.5 shadow-sm dark:bg-slate-900">Stock sistema: {row.systemStock}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((candidate) => candidate.id !== row.id))}
                    className="shrink-0 rounded-xl p-3 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    title="Quitar artículo de la muestra"
                    aria-label={`Quitar artículo ${row.article}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </header>

                <div className="space-y-4 p-5 md:p-6">
                  {mode === "manual" && (
                    <div className="grid gap-3 rounded-[1.4rem] border border-slate-200 bg-white p-4 md:grid-cols-2 dark:border-slate-700 dark:bg-slate-900">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Locación física observada
                        <input
                          value={row.observedLocation}
                          onChange={(event) => {
                            const observedLocation = event.target.value;
                            updateRow(row.id, {
                              observedLocation,
                              locationCheck: observedLocation.trim() ? normalizeLocation(observedLocation) === normalizeLocation(row.location) : null,
                            });
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </label>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Cantidad física observada
                        <input
                          value={row.physicalQuantity}
                          onChange={(event) => {
                            const physicalQuantity = event.target.value;
                            const physical = parseStock(physicalQuantity);
                            updateRow(row.id, {
                              physicalQuantity,
                              quantityCheck: physicalQuantity.trim() ? Number.isFinite(physical) && physical === row.systemStock : null,
                            });
                          }}
                          inputMode="decimal"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </label>
                    </div>
                  )}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <StockAuditQuestion
                      label="Requisito 1 de 2 · Locación"
                      question={`¿La locación física del artículo coincide con la locación indicada por el sistema (${row.location})?`}
                      value={row.locationCheck}
                      onChange={(value) => updateRow(row.id, { locationCheck: value })}
                    />
                    <StockAuditQuestion
                      label="Requisito 2 de 2 · Cantidad"
                      question={`¿La cantidad física coincide con el stock indicado por el sistema (${row.systemStock})?`}
                      value={row.quantityCheck}
                      onChange={(value) => updateRow(row.id, { quantityCheck: value })}
                    />
                  </div>

                  {needsComment && (
                    <label className="block text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-300">
                      Observación del desvío · obligatoria
                      <textarea
                        value={row.comment}
                        onChange={(event) => updateRow(row.id, { comment: event.target.value })}
                        placeholder="Describí qué diferencia encontraste en la locación o en la cantidad."
                        className="mt-2 min-h-24 w-full rounded-xl border border-red-300 bg-red-50 px-3 py-3 text-sm font-medium normal-case tracking-normal text-slate-900 placeholder:text-red-700/50 dark:border-red-800 dark:bg-red-950/20 dark:text-white"
                      />
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="fixed bottom-5 right-5 z-40 md:bottom-8 md:right-8"><button type="button" onClick={() => void saveControl()} disabled={isSubmitting || rows.length === 0} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-950 shadow-2xl shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isSubmitting ? "Guardando" : "Guardar control"}</button></div>
    </div>
  );
}