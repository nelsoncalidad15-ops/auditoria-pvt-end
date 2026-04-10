import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { AuditSession, AuditTemplateItem } from "../types";

// ?"??"??"? Colores corporativos ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?
const COLOR_DARK_BLUE: [number, number, number] = [12, 35, 64];
const COLOR_MID_BLUE: [number, number, number] = [30, 64, 120];
const COLOR_LIGHT_GRAY: [number, number, number] = [241, 245, 249];
const COLOR_TEXT_DARK: [number, number, number] = [15, 23, 42];
const COLOR_TEXT_MUTED: [number, number, number] = [100, 116, 139];
const COLOR_PASS: [number, number, number] = [22, 163, 74];
const COLOR_FAIL: [number, number, number] = [220, 38, 38];
const COLOR_NA: [number, number, number] = [100, 116, 139];
const COLOR_PENDING: [number, number, number] = [234, 88, 12];

// ?"??"??"? Helpers ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getStatusLabel(status?: "pass" | "fail" | "na") {
  if (status === "pass") return "Cumple";
  if (status === "fail") return "No cumple";
  if (status === "na") return "N/A";
  return "Pendiente";
}

function getStatusColor(status?: "pass" | "fail" | "na"): [number, number, number] {
  if (status === "pass") return COLOR_PASS;
  if (status === "fail") return COLOR_FAIL;
  if (status === "na") return COLOR_NA;
  return COLOR_PENDING;
}

function getSectionMetrics(items: AuditTemplateItem[], session: AuditSession) {
  const passCount = items.filter((t) => session.items.find((s) => s.question === t.text)?.status === "pass").length;
  const failCount = items.filter((t) => session.items.find((s) => s.question === t.text)?.status === "fail").length;
  const naCount = items.filter((t) => session.items.find((s) => s.question === t.text)?.status === "na").length;
  const pendingCount = items.filter((t) => !session.items.find((s) => s.question === t.text)).length;
  const validCount = passCount + failCount;

  return {
    total: items.length,
    passCount,
    failCount,
    naCount,
    pendingCount,
    score: validCount > 0 ? Math.round((passCount / validCount) * 100) : 0,
  };
}

type PdfWithTable = jsPDF & { lastAutoTable?: { finalY?: number } };

function getLastY(pdf: PdfWithTable, fallback: number) {
  return (pdf as PdfWithTable).lastAutoTable?.finalY ?? fallback;
}

function drawPageFooter(pdf: jsPDF, sessionId: string) {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setDrawColor(...COLOR_LIGHT_GRAY);
  pdf.setLineWidth(0.3);
  pdf.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLOR_TEXT_MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Auditor?a ${sessionId}`, 14, pageHeight - 5);
  pdf.text(`P?gina ${pdf.getCurrentPageInfo().pageNumber}`, pageWidth - 14, pageHeight - 5, { align: "right" });
}

function drawSectionHeader(pdf: jsPDF, title: string, score: number, y: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  // Barra azul de secci?n
  pdf.setFillColor(...COLOR_DARK_BLUE);
  pdf.roundedRect(14, y, pageWidth - 28, 10, 1.5, 1.5, "F");

  // Nombre secci?n
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text(title, 19, y + 6.8);

  // Score alineado a la derecha
  const scoreColor = score >= 85 ? COLOR_PASS : score >= 60 ? COLOR_PENDING : COLOR_FAIL;
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
  const barColor = score >= 85 ? COLOR_PASS : score >= 60 ? COLOR_PENDING : COLOR_FAIL;
  pdf.setFillColor(...barColor);
  pdf.rect(x, y, fillW, h, "F");
}

// ?"??"??"? P?gina 1: Portada y resumen ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?

function drawCoverPage(
  pdf: jsPDF,
  params: {
    appTitle: string;
    session: AuditSession;
    auditorName: string;
    auditedFileNames: string[];
    groupedSections: [string, AuditTemplateItem[]][];
  }
) {
  const { appTitle, session, auditorName, auditedFileNames, groupedSections } = params;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const createdAt = new Date();

  // ?"??"? Cabecera ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?
  pdf.setFillColor(...COLOR_DARK_BLUE);
  pdf.rect(0, 0, pageWidth, 38, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(appTitle, 14, 15);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("Reporte de Auditor?a", 14, 22);
  pdf.text(`Generado: ${createdAt.toLocaleString("es-AR")}`, 14, 28);

  // Score total grande arriba a la derecha
  const totalScore = session.totalScore;
  const totalScoreColor = totalScore >= 85 ? COLOR_PASS : totalScore >= 60 ? COLOR_PENDING : COLOR_FAIL;
  pdf.setFillColor(...totalScoreColor);
  pdf.roundedRect(pageWidth - 14 - 34, 6, 34, 26, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`${totalScore}%`, pageWidth - 14 - 17, 20, { align: "center" });
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.text("PUNTAJE TOTAL", pageWidth - 14 - 17, 27, { align: "center" });

  // ?"??"? Datos generales ?"??"??"??"??"??"??"??"??"?
  pdf.setTextColor(...COLOR_TEXT_DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Datos de la auditor?a", 14, 50);

  autoTable(pdf, {
    startY: 54,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.8, textColor: [51, 65, 85] },
    body: [
      ["Fecha", session.date],
      ["Sucursal", session.location],
      ["Auditor", auditorName],
      ["Puesto / ?rea", session.role || "General"],
      ...(session.role === "Pre Entrega"
        ? []
        : [["Personal auditado", session.staffName || "Sin asignar"]]),
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

  // ?"??"? Resumen por secci?n ?"??"??"??"??"?
  const afterInfoY = getLastY(pdf as PdfWithTable, 100);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...COLOR_TEXT_DARK);
  pdf.text("Resumen por secci?n", 14, afterInfoY + 10);

  const sectionRows = groupedSections.map(([sectionName, items]) => {
    const m = getSectionMetrics(items, session);
    return { sectionName, m };
  });

  autoTable(pdf, {
    startY: afterInfoY + 14,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3, textColor: [51, 65, 85] },
    head: [["Seccion", "Items", "Cumple", "No cumple", "N/A", "Pendiente", "Score"]],
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
        data.cell.styles.textColor = val >= 85 ? COLOR_PASS : val >= 60 ? COLOR_PENDING : COLOR_FAIL;
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

  // Dibujamos barras de progreso debajo de la tabla de secciones
  const afterTableY = getLastY(pdf as PdfWithTable, 180);
  const pageHeight = pdf.internal.pageSize.getHeight();
  const availableSpace = pageHeight - afterTableY - 18;
  const barRowH = 7.5;
  const canFitBars = availableSpace >= sectionRows.length * barRowH + 10;

  if (canFitBars) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...COLOR_TEXT_DARK);
    pdf.text("?ndice visual de cumplimiento", 14, afterTableY + 8);

    sectionRows.forEach(({ sectionName, m }, i) => {
      const rowY = afterTableY + 13 + i * barRowH;
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...COLOR_TEXT_DARK);
      const label = sectionName.length > 35 ? sectionName.slice(0, 33) + "???" : sectionName;
      pdf.text(label, 14, rowY + 2.5);
      drawScoreBar(pdf, m.score, 90, rowY, 80);
      const scoreCol = m.score >= 85 ? COLOR_PASS : m.score >= 60 ? COLOR_PENDING : COLOR_FAIL;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...scoreCol);
      pdf.text(`${m.score}%`, 174, rowY + 2.5);
    });
  }

  drawPageFooter(pdf, session.id);
}

// ?"??"??"? P?ginas de detalle por secci?n ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?

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

  // Encabezado de secci?n
  drawSectionHeader(pdf, sectionName, metrics.score, 14);

  // Mini-resumen de la secci?n
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

  // Tabla de ?tems
  autoTable(pdf, {
    startY: 46,
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 2.6, textColor: [51, 65, 85], overflow: "linebreak" },
    head: [["#", "?tem evaluado", "Estado", "Observaci?n"]],
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
      ];
    }),
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 106 },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 42 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const status = items[data.row.index]
          ? session.items.find((s) => s.question === items[data.row.index].text)?.status
          : undefined;
        data.cell.styles.textColor = getStatusColor(status);
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      drawPageFooter(pdf, session.id);
    },
  });

  drawPageFooter(pdf, session.id);
}

// ?"??"??"? Export principal ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?

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

  // P?gina 1: portada + resumen completo
  drawCoverPage(pdf, { appTitle, session, auditorName, auditedFileNames, groupedSections });

  // P?ginas siguientes: una por secci?n
  groupedSections.forEach(([sectionName, items], index) => {
    drawSectionDetailPage(pdf, sectionName, items, session, index === 0);
  });

  const fileName =
    sanitizeFileName(
      `reporte-${session.location}-${session.role || "auditoria"}-${session.date}`
    ) || "reporte-auditoria";
  pdf.save(`${fileName}.pdf`);
}
