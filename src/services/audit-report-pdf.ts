import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { AuditItem, AuditSession, AuditTemplateItem, OrResponsibleRole } from "../types";
import {
  calculateAuditCompliance,
  calculateCampaignRoleMetrics,
  calculateRoleScores,
} from "./or-audit";
import { getStoredAuditCategories } from "./audit-structure";
import { OR_CHECKLIST_ITEMS } from "../constants";

// Colores corporativos
const COLOR_DARK_BLUE: [number, number, number] = [12, 35, 64];
const COLOR_MID_BLUE: [number, number, number] = [30, 64, 120];
const COLOR_LIGHT_GRAY: [number, number, number] = [241, 245, 249];
const COLOR_TEXT_DARK: [number, number, number] = [15, 23, 42];
const COLOR_TEXT_MUTED: [number, number, number] = [100, 116, 139];
const COLOR_PASS: [number, number, number] = [22, 163, 74];
const COLOR_FAIL: [number, number, number] = [220, 38, 38];
const COLOR_NA: [number, number, number] = [100, 116, 139];
const COLOR_PENDING: [number, number, number] = [234, 88, 12];

// Helpers

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getStatusLabel(status?: "pass" | "fail" | "na" | "calculated") {
  if (status === "pass") return "Cumple";
  if (status === "fail") return "No cumple";
  if (status === "na") return "N/A";
  if (status === "calculated") return "Calculado";
  return "Pendiente";
}

function getStatusColor(status?: "pass" | "fail" | "na" | "calculated"): [number, number, number] {
  if (status === "pass") return COLOR_PASS;
  if (status === "fail") return COLOR_FAIL;
  if (status === "na") return COLOR_NA;
  if (status === "calculated") return COLOR_MID_BLUE;
  return COLOR_PENDING;
}

function getSectionMetrics(items: AuditTemplateItem[], session: AuditSession) {
  const answers = items
    .map((template) => session.items.find((answer) => answer.id === template.id || answer.question === template.text))
    .filter((answer): answer is AuditItem => Boolean(answer));
  const passCount = answers.filter((answer) => answer.status === "pass").length;
  const failCount = answers.filter((answer) => answer.status === "fail").length;
  const naCount = answers.filter((answer) => answer.status === "na").length;
  const pendingCount = items.length - answers.filter((answer) => answer.status || typeof answer.calculatedScore === "number").length;
  const compliance = calculateAuditCompliance(answers);

  return {
    total: items.length,
    passCount,
    failCount,
    naCount,
    pendingCount,
    score: compliance.compliance,
  };
}

const ROLE_LABELS: Record<OrResponsibleRole, string> = {
  asesor: "Asesor de servicio",
  tecnico: "Técnico",
  controller: "Control de calidad",
  lavador: "Lavado",
  repuestos: "Repuestos",
};

function getRoleOwner(session: AuditSession, role: OrResponsibleRole) {
  const participantKey: Record<OrResponsibleRole, keyof NonNullable<AuditSession["participants"]>> = {
    asesor: "asesorServicio",
    tecnico: "tecnico",
    controller: "controller",
    lavador: "lavador",
    repuestos: "repuestos",
  };
  return session.participants?.[participantKey[role]]?.trim() || "Sin asignar";
}

type PdfWithTable = jsPDF & { lastAutoTable?: { finalY?: number } };

function getLastY(pdf: PdfWithTable, fallback: number) {
  return (pdf as PdfWithTable).lastAutoTable?.finalY ?? fallback;
}

function drawPageFooter(pdf: jsPDF, label: string) {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setDrawColor(...COLOR_LIGHT_GRAY);
  pdf.setLineWidth(0.3);
  pdf.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLOR_TEXT_MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Auditoría · ${label}`, 14, pageHeight - 5);
  pdf.text(`Página ${pdf.getCurrentPageInfo().pageNumber}`, pageWidth - 14, pageHeight - 5, { align: "right" });
}

function drawSectionHeader(pdf: jsPDF, title: string, score: number, y: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  // Barra azul de sección
  pdf.setFillColor(...COLOR_DARK_BLUE);
  pdf.roundedRect(14, y, pageWidth - 28, 10, 1.5, 1.5, "F");

  // Nombre sección
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text(title, 19, y + 6.8);

  // Score alineado a la derecha
  const scoreColor = score >= 90 ? COLOR_PASS : score >= 70 ? COLOR_PENDING : COLOR_FAIL;
  pdf.setFillColor(...scoreColor);
  pdf.roundedRect(pageWidth - 14 - 22, y + 1.5, 22, 7, 1, 1, "F");
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text(`${score}%`, pageWidth - 14 - 11, y + 6.8, { align: "center" });
}

function drawScoreBar(pdf: jsPDF, score: number, x: number, y: number, w: number) {
  const h = 3;
  pdf.setFillColor(...COLOR_LIGHT_GRAY);
  pdf.rect(x, y, w, h, "F");
  const fillW = Math.round((score / 100) * w);
  const barColor = score >= 90 ? COLOR_PASS : score >= 70 ? COLOR_PENDING : COLOR_FAIL;
  pdf.setFillColor(...barColor);
  pdf.rect(x, y, fillW, h, "F");
}

// Página 1: Portada y resumen

function drawCoverPage(
  pdf: jsPDF,
  params: {
    appTitle: string;
    session: AuditSession;
    auditorName: string;
    auditedFileNames: string[];
    groupedSections: [string, AuditTemplateItem[]][];
    templateItems?: AuditTemplateItem[];
  }
) {
  const { appTitle, session, auditorName, auditedFileNames, groupedSections, templateItems } = params;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const createdAt = new Date();

  // Cabecera
  pdf.setFillColor(...COLOR_DARK_BLUE);
  pdf.rect(0, 0, pageWidth, 38, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(appTitle, 14, 15);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Reporte de Auditoría", 14, 22);
  pdf.text(`Generado: ${createdAt.toLocaleString("es-AR")}`, 14, 28);

  // Score total grande arriba a la derecha
  const totalScore = session.totalScore;
  const totalScoreColor = totalScore >= 90 ? COLOR_PASS : totalScore >= 70 ? COLOR_PENDING : COLOR_FAIL;
  pdf.setFillColor(...totalScoreColor);
  pdf.roundedRect(pageWidth - 14 - 34, 6, 34, 26, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`${totalScore}%`, pageWidth - 14 - 17, 20, { align: "center" });
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.text("PUNTAJE TOTAL", pageWidth - 14 - 17, 27, { align: "center" });

  // Datos generales
  pdf.setTextColor(...COLOR_TEXT_DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Datos de la auditoría", 14, 50);

  autoTable(pdf, {
    startY: 54,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.8, textColor: [51, 65, 85] },
    body: [
      ["Fecha", session.date],
      ["Sucursal", session.location],
      ["Auditor", auditorName],
      ["Puesto / Área", session.role || "General"],
      ...(session.sampleTarget ? [["Objetivo de la campaña", `${session.sampleTarget} OR`]] : []),
      ...(session.selectedStaffNames?.length
        ? [["Nómina seleccionada", session.selectedStaffNames.join(", ")]]
        : []),
      ...(session.role === "Pre Entrega"
        ? []
        : [["Personal auditado", session.staffName || "Sin asignar"]]),
      ...(session.role === "Ordenes" ? [
        ["Asesor de servicio", session.participants?.asesorServicio || session.staffName || "Sin asignar"],
        ["Técnico", session.participants?.tecnico || "Sin asignar"],
        ["Controller", session.participants?.controller || "Sin asignar"],
        ["Lavador", session.participants?.lavador || "Sin asignar"],
        ["Repuestos", session.participants?.repuestos || "Sin asignar"],
      ] : []),
      [
        "Legajos auditados",
        auditedFileNames.length > 0 ? auditedFileNames.join(", ") : "Sin legajos cargados",
      ],
      ["Observaciones generales", session.notes || "Sin observaciones"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 46, fillColor: COLOR_LIGHT_GRAY },
      1: { cellWidth: 136 },
    },
  });

  // Resumen por sección
  const afterInfoY = getLastY(pdf as PdfWithTable, 100);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...COLOR_TEXT_DARK);
  pdf.text("Resumen por sección", 14, afterInfoY + 10);

  const sectionRows = groupedSections.map(([sectionName, items]) => {
    const m = getSectionMetrics(items, session);
    return { sectionName, m };
  });

  autoTable(pdf, {
    startY: afterInfoY + 14,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3, textColor: [51, 65, 85] },
    head: [["Sección", "Ítems", "Cumple", "No cumple", "N/A", "Pendiente", "Score"]],
    headStyles: {
      fillColor: COLOR_DARK_BLUE,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    body: sectionRows.map(({ sectionName, m }) => [
      sectionName,
      String(m.total),
      String(m.passCount),
      String(m.failCount),
      String(m.naCount),
      String(m.pendingCount),
      `${m.score}%`,
    ]),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const raw = String(data.cell.raw).replace("%", "");
        const val = parseInt(raw, 10);
        data.cell.styles.textColor = val >= 90 ? COLOR_PASS : val >= 70 ? COLOR_PENDING : COLOR_FAIL;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 3 && Number(data.cell.raw) > 0) {
        data.cell.styles.textColor = COLOR_FAIL;
      }
      if (data.section === "body" && data.column.index === 2 && Number(data.cell.raw) > 0) {
        data.cell.styles.textColor = COLOR_PASS;
      }
    },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 22, halign: "center" },
      6: { cellWidth: 20, halign: "center" },
    },
  });

  // El impacto por área usa exactamente la configuración de responsables del punto
  const roleRows = calculateRoleScores(session.items, true, templateItems).filter((row) => row.totalApplicableWeight > 0);
  let afterTableY = getLastY(pdf as PdfWithTable, 180);
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (roleRows.length > 0 && pageHeight - afterTableY > 48) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...COLOR_TEXT_DARK);
    pdf.text("Impacto por responsable", 14, afterTableY + 8);
    autoTable(pdf, {
      startY: afterTableY + 12,
      theme: "grid",
      head: [["Área / rol", "Responsable", "Ítems", "Cumplimiento"]],
      headStyles: { fillColor: COLOR_DARK_BLUE, textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2.3, textColor: COLOR_TEXT_DARK },
      body: roleRows.map((row) => [ROLE_LABELS[row.role], getRoleOwner(session, row.role), String(row.itemsCount), `${row.compliance}%`]),
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const score = Number(String(data.cell.raw).replace("%", ""));
          data.cell.styles.textColor = score >= 90 ? COLOR_PASS : score >= 70 ? COLOR_PENDING : COLOR_FAIL;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    afterTableY = getLastY(pdf as PdfWithTable, afterTableY + 35);
  }

  // Barras de progreso debajo de la tabla
  const availableSpace = pageHeight - afterTableY - 18;
  const barRowH = 7.5;
  const canFitBars = availableSpace >= sectionRows.length * barRowH + 10;

  if (canFitBars) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...COLOR_TEXT_DARK);
    pdf.text("Índice visual de cumplimiento", 14, afterTableY + 8);

    sectionRows.forEach(({ sectionName, m }, i) => {
      const rowY = afterTableY + 13 + i * barRowH;
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...COLOR_TEXT_DARK);
      const label = sectionName.length > 35 ? sectionName.slice(0, 33) + "..." : sectionName;
      pdf.text(label, 14, rowY + 2.5);
      drawScoreBar(pdf, m.score, 90, rowY, 80);
      const scoreCol = m.score >= 90 ? COLOR_PASS : m.score >= 70 ? COLOR_PENDING : COLOR_FAIL;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...scoreCol);
      pdf.text(`${m.score}%`, 174, rowY + 2.5);
    });
  }

  drawPageFooter(pdf, session.orderNumber ? `OR ${session.orderNumber}` : session.id);
}

// Páginas de detalle por sección

function drawSectionDetailPage(
  pdf: jsPDF,
  sectionName: string,
  items: AuditTemplateItem[],
  session: AuditSession,
  isFirstSection: boolean
) {
  if (!isFirstSection) {
    pdf.addPage();
  } else {
    pdf.addPage();
  }

  const metrics = getSectionMetrics(items, session);

  // Encabezado de sección
  drawSectionHeader(pdf, sectionName, metrics.score, 14);

  // Mini-resumen de la sección
  const pageWidth = pdf.internal.pageSize.getWidth();
  const statItems = [
    { label: "Cumple", value: metrics.passCount, color: COLOR_PASS },
    { label: "No cumple", value: metrics.failCount, color: COLOR_FAIL },
    { label: "N/A", value: metrics.naCount, color: COLOR_NA },
    { label: "Pendiente", value: metrics.pendingCount, color: COLOR_PENDING },
    { label: "Total", value: metrics.total, color: COLOR_MID_BLUE },
  ];
  const boxW = (pageWidth - 28) / statItems.length;
  statItems.forEach(({ label, value, color }, i) => {
    const bx = 14 + i * boxW;
    pdf.setFillColor(...COLOR_LIGHT_GRAY);
    pdf.roundedRect(bx + 0.5, 27, boxW - 1, 14, 1, 1, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...color);
    pdf.text(String(value), bx + boxW / 2, 36, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...COLOR_TEXT_MUTED);
    pdf.text(label, bx + boxW / 2, 38.5, { align: "center" });
  });

  // Tabla de ítems
  autoTable(pdf, {
    startY: 46,
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 2.6, textColor: [51, 65, 85], overflow: "linebreak" },
    head: [["#", "Ítem evaluado", "Estado", "Observación", "Evidencia"]],
    headStyles: {
      fillColor: COLOR_MID_BLUE,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    body: items.map((templateItem, idx) => {
      const answer = session.items.find((s) => s.question === templateItem.text);
      return [
        String(idx + 1),
        templateItem.text,
        getStatusLabel(answer?.status),
        answer?.comment || "-",
        answer?.photoUrl ? "Abrir foto" : "-",
      ];
    }),
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 82 },
      2: { cellWidth: 24, halign: "center" },
      3: { cellWidth: 42 },
      4: { cellWidth: 28, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const status = items[data.row.index]
          ? session.items.find((s) => s.question === items[data.row.index].text)?.status
          : undefined;
        data.cell.styles.textColor = getStatusColor(status);
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 4 && data.cell.raw !== "-") {
        data.cell.styles.textColor = COLOR_MID_BLUE;
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 4) return;
      const answer = items[data.row.index]
        ? session.items.find((item) => item.id === items[data.row.index].id || item.question === items[data.row.index].text)
        : undefined;
      if (answer?.photoUrl) {
        pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: answer.photoUrl });
      }
    },
    didDrawPage: () => {
      drawPageFooter(pdf, session.orderNumber ? `OR ${session.orderNumber}` : session.id);
    },
  });

  drawPageFooter(pdf, session.orderNumber ? `OR ${session.orderNumber}` : session.id);
}

// Export principal para auditoría individual

export function generateAuditPdfReport(params: {
  appTitle: string;
  session: AuditSession;
  auditorName: string;
  templateItems: AuditTemplateItem[];
}) {
  const { appTitle, session, auditorName, templateItems } = params;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const auditedFileNames = session.auditedFileNames?.map((n) => n.trim()).filter(Boolean) ?? [];

  const groupedSections = Array.from(
    templateItems.reduce((acc, item) => {
      const blockName = item.block?.trim() || "General";
      const current = acc.get(blockName) ?? [];
      current.push(item);
      acc.set(blockName, current);
      return acc;
    }, new Map<string, AuditTemplateItem[]>())
  );

  // Página 1: portada + resumen completo
  drawCoverPage(pdf, { appTitle, session, auditorName, auditedFileNames, groupedSections, templateItems });

  // Páginas siguientes: una por sección
  groupedSections.forEach(([sectionName, items], index) => {
    drawSectionDetailPage(pdf, sectionName, items, session, index === 0);
  });

  const fileName =
    sanitizeFileName(
      `reporte-${session.location}-${session.role || "auditoria"}-${session.date}`
    ) || "reporte-auditoria";
  pdf.save(`${fileName}.pdf`);
}

// Export para reporte de campaña de Órdenes

export function generateOrdersCampaignPdf(params: {
  appTitle: string;
  audits: AuditSession[];
  auditorName: string;
  sampleTarget: number;
  templateItems?: AuditTemplateItem[];
}) {
  const { appTitle, audits, auditorName, sampleTarget, templateItems } = params;
  if (audits.length === 0) return;

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const averageScore = Math.round(audits.reduce((sum, audit) => sum + (audit.totalScore || 0), 0) / audits.length);
  const totalDeviations = audits.reduce((sum, audit) => sum + (audit.items || []).filter((item) => item.status === "fail").length, 0);
  const first = audits[0];

  // Plantilla oficial o configurada para determinar responsables con trazabilidad exacta
  const effectiveTemplateItems: AuditTemplateItem[] = (templateItems && templateItems.length > 0)
    ? templateItems
    : (getStoredAuditCategories(first.location).find((c) => c.name === "Ordenes")?.items ?? OR_CHECKLIST_ITEMS);

  const advisorMetrics = Array.from(audits.reduce((groups, audit) => {
    const advisor = audit.staffName || audit.participants?.asesorServicio || "Sin asignar";
    const current = groups.get(advisor) || { total: 0, count: 0 };
    current.total += audit.totalScore || 0;
    current.count += 1;
    groups.set(advisor, current);
    return groups;
  }, new Map<string, { total: number; count: number }>())).map(([name, metric]) => ({
    name,
    score: Math.round(metric.total / metric.count),
    count: metric.count,
  })).sort((left, right) => left.score - right.score);

  const deviations = audits.flatMap((audit) => (audit.items || [])
    .filter((item) => item.status === "fail")
    .map((item) => {
      const template = effectiveTemplateItems.find((t) => t.id === item.id || t.text === item.question);
      const roles = (template?.responsibleRoles && template.responsibleRoles.length > 0)
        ? template.responsibleRoles
        : (Array.isArray(item.responsibleRoles) ? item.responsibleRoles : []);
      const roleLabel = roles.map((r) => ROLE_LABELS[r] || r).join(", ") || "Sin rol";

      return {
        order: audit.orderNumber || "Sin número",
        advisor: audit.staffName || audit.participants?.asesorServicio || "Sin asignar",
        roles: roleLabel,
        question: item.question,
        note: item.comment?.trim() || (item.photoUrl ? "Evidencia fotográfica adjunta" : "Sin nota"),
        photoUrl: item.photoUrl || "",
      };
    }));

  // Cálculo consolidado ponderado y trazable por área (evita promedios simples engañosos)
  const roleMetrics = calculateCampaignRoleMetrics(audits, effectiveTemplateItems);

  const frequentDeviations = Array.from(deviations.reduce((groups, deviation) => {
    const key = deviation.question.trim();
    groups.set(key, (groups.get(key) || 0) + 1);
    return groups;
  }, new Map<string, number>())).map(([question, count]) => ({ question, count }))
    .sort((left, right) => right.count - left.count || left.question.localeCompare(right.question));

  const campaignFooterLabel = first.auditBatchName
    ? `${first.location} · ${first.auditBatchName}`
    : `${first.location} · ${first.date}`;

  // Encabezado
  pdf.setFillColor(...COLOR_DARK_BLUE);
  pdf.rect(0, 0, pageWidth, 38, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text(appTitle, 14, 15);
  pdf.setFontSize(11);
  pdf.text("Resumen de campaña de Órdenes", 14, 24);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(`Generado: ${new Date().toLocaleString("es-AR")}`, 14, 30);

  autoTable(pdf, {
    startY: 47,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3, textColor: COLOR_TEXT_DARK },
    body: [
      ["Sucursal", first.location || "-"],
      ["Fecha / ciclo", first.auditBatchName || first.date || "-"],
      ["Auditor", auditorName],
      ["Avance", `${audits.length} de ${sampleTarget} OR`],
      ["Resultado promedio", `${averageScore}%`],
      ["Desvíos detectados", String(totalDeviations)],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 52, fillColor: COLOR_LIGHT_GRAY },
      1: { cellWidth: 130 },
    },
  });

  let chartY = getLastY(pdf as PdfWithTable, 95) + 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...COLOR_TEXT_DARK);
  pdf.text("Cumplimiento por asesor", 14, chartY);
  chartY += 6;

  advisorMetrics.slice(0, 12).forEach((metric) => {
    const labelWidth = 48;
    const barX = 14 + labelWidth;
    const barWidth = pageWidth - barX - 24;
    const scoreWidth = Math.max(0, Math.min(barWidth, (barWidth * metric.score) / 100));
    const barColor = metric.score >= 90 ? COLOR_PASS : metric.score >= 70 ? COLOR_PENDING : COLOR_FAIL;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...COLOR_TEXT_DARK);
    pdf.text(`${metric.name} (${metric.count})`, 14, chartY + 3.2, { maxWidth: labelWidth - 3 });
    pdf.setFillColor(...COLOR_LIGHT_GRAY);
    pdf.roundedRect(barX, chartY, barWidth, 4.5, 1, 1, "F");
    pdf.setFillColor(...barColor);
    if (scoreWidth > 0) pdf.roundedRect(barX, chartY, scoreWidth, 4.5, 1, 1, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text(`${metric.score}%`, pageWidth - 14, chartY + 3.2, { align: "right" });
    chartY += 7.5;
  });

  // Cumplimiento por área: tabla completa, verificable y con trazabilidad exacta de desvíos
  const areaTableStartY = chartY + 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...COLOR_TEXT_DARK);
  pdf.text("Cumplimiento por área", 14, areaTableStartY);

  autoTable(pdf, {
    startY: areaTableStartY + 4,
    theme: "grid",
    head: [["Área / Rol", "Evaluados", "Conformes", "Desvíos", "Cumplimiento", "Detalle de desvíos (OR y punto evaluado)"]],
    headStyles: {
      fillColor: COLOR_DARK_BLUE,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: { fontSize: 7.5, cellPadding: 2.2, textColor: COLOR_TEXT_DARK, valign: "middle" },
    body: roleMetrics.map((metric) => {
      const scoreLabel = metric.compliance !== null ? `${metric.compliance}%` : "Sin evaluación";
      const deviationsSummary = metric.deviations.length === 0
        ? (metric.applicableControls > 0 ? "Sin desvíos (100% conforme)" : "Sin controles aplicables")
        : metric.deviations
            .map((d) => `${d.order}: ${d.question}`)
            .slice(0, 3)
            .join("\n") + (metric.deviations.length > 3 ? `\n(+${metric.deviations.length - 3} desvíos adicionales)` : "");

      return [
        metric.label,
        String(metric.applicableControls),
        String(metric.compliantControls),
        String(metric.deviationsCount),
        scoreLabel,
        deviationsSummary,
      ];
    }),
    columnStyles: {
      0: { cellWidth: 34, fontStyle: "bold" },
      1: { cellWidth: 16, halign: "center" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 24, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 76, fontSize: 7 },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.column.index === 4) {
          const raw = String(data.cell.raw);
          if (raw.includes("%")) {
            const val = parseInt(raw.replace("%", ""), 10);
            data.cell.styles.textColor = val >= 90 ? COLOR_PASS : val >= 70 ? COLOR_PENDING : COLOR_FAIL;
          } else {
            data.cell.styles.textColor = COLOR_TEXT_MUTED;
          }
        }
        if (data.column.index === 3 && Number(data.cell.raw) > 0) {
          data.cell.styles.textColor = COLOR_FAIL;
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 2 && Number(data.cell.raw) > 0) {
          data.cell.styles.textColor = COLOR_PASS;
        }
      }
    },
  });

  const ordersTableY = getLastY(pdf as PdfWithTable, areaTableStartY + 45) + 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...COLOR_TEXT_DARK);
  pdf.text("Detalle de órdenes auditadas", 14, ordersTableY);

  autoTable(pdf, {
    startY: ordersTableY + 4,
    theme: "grid",
    head: [["OR", "Asesor", "Técnico", "Lavador", "Resultado", "Desvíos"]],
    headStyles: { fillColor: COLOR_DARK_BLUE, textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: COLOR_TEXT_DARK },
    body: audits.map((audit) => [
      audit.orderNumber || "Sin número",
      audit.staffName || audit.participants?.asesorServicio || "Sin asignar",
      audit.participants?.tecnico || "Sin asignar",
      audit.participants?.lavador || "Sin asignar",
      `${audit.totalScore || 0}%`,
      String((audit.items || []).filter((item) => item.status === "fail").length),
    ]),
    didDrawPage: () => drawPageFooter(pdf, campaignFooterLabel),
  });

  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(...COLOR_TEXT_DARK);
  pdf.text("Desvíos detectados", 14, 20);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLOR_TEXT_MUTED);
  pdf.text(deviations.length > 0
    ? `${deviations.length} incumplimiento${deviations.length === 1 ? "" : "s"} que requieren seguimiento.`
    : "No se detectaron incumplimientos en las OR auditadas.", 14, 27);

  if (deviations.length > 0) {
    let deviationsTableY = 34;
    if (frequentDeviations.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...COLOR_TEXT_DARK);
      pdf.text("Desvíos más frecuentes", 14, 36);
      let frequencyY = 42;
      const maxFrequency = frequentDeviations[0].count;
      frequentDeviations.slice(0, 6).forEach((entry) => {
        const label = entry.question.length > 52 ? `${entry.question.slice(0, 49)}...` : entry.question;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLOR_TEXT_DARK);
        pdf.text(label, 14, frequencyY + 3, { maxWidth: 104 });
        pdf.setFillColor(...COLOR_LIGHT_GRAY);
        pdf.roundedRect(121, frequencyY, 58, 4.5, 1, 1, "F");
        pdf.setFillColor(...COLOR_FAIL);
        pdf.roundedRect(121, frequencyY, Math.max(2, 58 * entry.count / maxFrequency), 4.5, 1, 1, "F");
        pdf.setFont("helvetica", "bold");
        pdf.text(`${entry.count}x`, pageWidth - 14, frequencyY + 3.2, { align: "right" });
        frequencyY += 8;
      });
      deviationsTableY = frequencyY + 5;
    }
    autoTable(pdf, {
      startY: deviationsTableY,
      theme: "grid",
      head: [["OR", "Asesor", "Área afectada", "Desvío", "Nota", "Evidencia"]],
      headStyles: { fillColor: COLOR_FAIL, textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2.8, textColor: COLOR_TEXT_DARK, valign: "top", overflow: "linebreak" },
      body: deviations.map((deviation) => [
        deviation.order,
        deviation.advisor,
        deviation.roles,
        deviation.question,
        deviation.note,
        deviation.photoUrl ? "Abrir foto" : "-",
      ]),
      columnStyles: {
        0: { cellWidth: 20, fontStyle: "bold" },
        1: { cellWidth: 32 },
        2: { cellWidth: 30, fontStyle: "bold" },
        3: { cellWidth: 50 },
        4: { cellWidth: 30 },
        5: { cellWidth: 20, halign: "center", textColor: COLOR_MID_BLUE, fontStyle: "bold" },
      },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 5) return;
        const photoUrl = deviations[data.row.index]?.photoUrl;
        if (photoUrl) pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: photoUrl });
      },
      didDrawPage: () => drawPageFooter(pdf, campaignFooterLabel),
    });
  } else {
    pdf.setFillColor(236, 253, 245);
    pdf.roundedRect(14, 36, pageWidth - 28, 22, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...COLOR_PASS);
    pdf.text("Campaña sin desvíos registrados", pageWidth / 2, 49, { align: "center" });
    drawPageFooter(pdf, campaignFooterLabel);
  }

  const fileName = sanitizeFileName(`campana-ordenes-${first.location}-${first.date}`) || "campana-ordenes";
  pdf.save(`${fileName}.pdf`);
}
