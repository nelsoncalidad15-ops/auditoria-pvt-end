var SUMMARY_SHEET_NAME = 'Auditorias';
var ITEMS_SHEET_NAME = 'AuditoriaItems';
var STRUCTURE_SHEET_PREFIX = 'Auditoria - ';
var LEGACY_STRUCTURE_SHEET_NAME = 'ConfiguracionAuditoria';
var DRIVE_FOLDER_ID_PROPERTY = 'DRIVE_FOLDER_ID';
var STRUCTURE_SHEET_HEADERS = [
  'Alcance',
  'ID de \u00e1rea',
  '\u00c1rea',
  'Descripci\u00f3n del \u00e1rea',
  'Colaboradores auditados',
  'ID de pregunta',
  'Orden',
  'Bloque',
  'Pregunta',
  'Descripci\u00f3n',
  'Peso',
  'Obligatoria',
  'Permite N/A',
  'Tipo de respuesta',
  'Modo de puntaje',
  'Activa',
  'Exige comentario si responde No',
  'Prioridad',
  'Gu\u00eda para el auditor',
  'Sector',
  'Roles responsables',
  'V\u00ednculos de puntaje'
];
var STRUCTURE_SHEET_HEADER_KEYS = {
  'Alcance': 'scope',
  'ID de \u00e1rea': 'categoryId',
  '\u00c1rea': 'categoryName',
  'Descripci\u00f3n del \u00e1rea': 'categoryDescription',
  'Colaboradores auditados': 'staffOptions',
  'ID de pregunta': 'itemId',
  'Orden': 'order',
  'Bloque': 'block',
  'Pregunta': 'question',
  'Descripci\u00f3n': 'description',
  'Peso': 'weight',
  'Obligatoria': 'required',
  'Permite N/A': 'allowsNa',
  'Tipo de respuesta': 'responseType',
  'Modo de puntaje': 'calculationMode',
  'Activa': 'active',
  'Exige comentario si responde No': 'requiresCommentOnFail',
  'Prioridad': 'priority',
  'Gu\u00eda para el auditor': 'guidance',
  'Sector': 'sector',
  'Roles responsables': 'responsibleRoles',
  'V\u00ednculos de puntaje': 'scoreLinks'
};

var CALCULATION_RULES_SHEET_NAME = 'Reglas de cálculo';
var CALCULATION_RULES_HEADERS = [
  'Activa',
  'Alcance',
  'ID de regla',
  'Área destino',
  'ID pregunta destino',
  'Tipo de origen',
  'Área origen',
  'ID pregunta origen',
  'Rol OR origen',
  'Método',
  'Peso de fuente',
  'Cobertura mínima',
  'Detalle'
];
var CALCULATION_RULES_HEADER_KEYS = {
  'ID de regla': 'id',
  'Área destino': 'targetArea',
  'ID pregunta destino': 'targetItemId',
  'Tipo de origen': 'sourceType',
  'Área origen': 'sourceArea',
  'ID pregunta origen': 'sourceItemId',
  'Rol OR origen': 'sourceRole',
  'Método': 'method',
  'Peso de fuente': 'sourceWeight',
  'Cobertura mínima': 'minimumCoverage',
  'Detalle': 'detail'
};

var PROCESS_DEFINITIONS_SHEET_NAME = 'Resultados por proceso';
var PROCESS_DEFINITIONS_HEADERS = [
  'Activa',
  'Alcance',
  'ID de proceso',
  'Proceso',
  'Áreas incluidas',
  'Pesos',
  'Cobertura mínima',
  'Orden'
];
var PROCESS_DEFINITIONS_HEADER_KEYS = {
  'ID de proceso': 'id',
  'Proceso': 'name',
  'Áreas incluidas': 'areas',
  'Pesos': 'weights',
  'Cobertura mínima': 'minimumCoverage',
  'Orden': 'order'
};
var STOCK_CONTROL_SHEET_NAME = 'Control físico Repuestos';
var STOCK_CONTROL_HEADERS = [
  'ID de control',
  'Fecha de registro',
  'Fecha de auditoría',
  'Ciclo',
  'Sucursal',
  'Auditor',
  'Origen',
  'Locación sistema',
  'Línea',
  'Artículo',
  'Descripción',
  'Stock sistema',
  'Ubicación coincide',
  'Cantidad coincide',
  'Locación física',
  'Cantidad física',
  'Observación'
];
var STOCK_CONTROL_HEADER_KEYS = {
  'ID de control': 'auditId',
  'Fecha de registro': 'submittedAt',
  'Fecha de auditoría': 'auditDate',
  'Ciclo': 'auditBatchName',
  'Sucursal': 'location',
  'Auditor': 'auditorName',
  'Origen': 'source',
  'Locación sistema': 'systemLocation',
  'Línea': 'line',
  'Artículo': 'article',
  'Descripción': 'description',
  'Stock sistema': 'systemStock',
  'Ubicación coincide': 'locationResult',
  'Cantidad coincide': 'quantityResult',
  'Locación física': 'observedLocation',
  'Cantidad física': 'physicalQuantity',
  'Observación': 'comment'
};
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.mode === 'history') {
      return buildHistoryResponse_(e);
    }

    if (e && e.parameter && e.parameter.mode === 'structure') {
      return buildStructureResponse_();
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, service: 'audit-sync', version: '1.0' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');

    var spreadsheet = getSpreadsheet_();
    var summarySheet = getOrCreateSheet_(spreadsheet, SUMMARY_SHEET_NAME, [
      'auditId',
      'submittedAt',
      'auditDate',
      'auditBatchName',
      'sampleTarget',
      'selectedStaffNames',
      'location',
      'auditorId',
      'auditorName',
      'role',
      'staffName',
      'orderNumber',
      'totalScore',
      'passCount',
      'failCount',
      'naCount',
      'answeredCount',
      'itemsCount',
      'notes',
      'submittedByEmail',
      'asesorServicio',
      'tecnico',
      'controller',
      'lavador',
      'repuestos',
      'entityType'
    ]);
    var itemsSheet = getOrCreateSheet_(spreadsheet, ITEMS_SHEET_NAME, [
      'auditId',
      'submittedAt',
      'auditDate',
      'auditBatchName',
      'location',
      'auditorName',
      'role',
      'staffName',
      'questionIndex',
      'itemId',
      'question',
      'description',
      'sector',
      'responsibleRoles',
      'scoreAreas',
      'scoreLinks',
      'weight',
      'allowsNa',
      'status',
      'statusLabel',
      'calculatedScore',
      'calculationState',
      'calculationDetail',
      'comment',
      'photoUrl'
    ]);

    if (payload && payload.event === 'structure_replace') {
      var structureResult = replaceStructureScope_(spreadsheet, payload);

      return ContentService
        .createTextOutput(JSON.stringify({
          ok: true,
          scope: structureResult.scope,
          categoryCount: structureResult.categoryCount,
          itemCount: structureResult.itemCount
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }    if (payload && payload.event === 'calculation_rules_replace') {
      var rulesSheet = getOrCreateSheet_(spreadsheet, CALCULATION_RULES_SHEET_NAME, CALCULATION_RULES_HEADERS);
      var rulesResult = replaceCalculationRulesScope_(rulesSheet, payload);

      return ContentService
        .createTextOutput(JSON.stringify({
          ok: true,
          scope: rulesResult.scope,
          ruleCount: rulesResult.ruleCount
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (payload && payload.event === 'process_definitions_replace') {
      var processSheet = getOrCreateSheet_(spreadsheet, PROCESS_DEFINITIONS_SHEET_NAME, PROCESS_DEFINITIONS_HEADERS);
      var processResult = replaceProcessDefinitionsScope_(processSheet, payload);

      return ContentService
        .createTextOutput(JSON.stringify({
          ok: true,
          scope: processResult.scope,
          processCount: processResult.processCount
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (payload && payload.event === 'stock_control_submit') {
      validatePayload_(payload);
      validateStockControlPayload_(payload);
      var stockSheet = getOrCreateSheet_(spreadsheet, STOCK_CONTROL_SHEET_NAME, STOCK_CONTROL_HEADERS);
      var normalizedStockItemRows = normalizeItemRows_(payload.audit, payload.sheet.itemRows || []);

      deleteRowsByAuditId_(summarySheet, payload.audit.id);
      deleteRowsByAuditId_(itemsSheet, payload.audit.id);
      deleteStockControlRows_(stockSheet, payload.audit.id);
      appendSummaryRow_(summarySheet, payload.sheet.summaryRow);
      appendItemRows_(itemsSheet, normalizedStockItemRows);
      appendObjectRows_(stockSheet, buildStockControlRows_(payload));

      return ContentService
        .createTextOutput(JSON.stringify({
          ok: true,
          auditId: payload.audit.id,
          savedRows: payload.stockRows.length
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }    if (payload && payload.event === 'audit_delete') {
      validateDeletePayload_(payload);
      var trashSheet = getOrCreateSheet_(spreadsheet, 'Papelera_Auditorias', [
        'deletedAt',
        'deletedBy',
        'reason',
        'auditId',
        'summaryData',
        'itemsCount'
      ]);

      var deleteResult = archiveAndDeleteAudit_(summarySheet, itemsSheet, trashSheet, payload);

      return ContentService
        .createTextOutput(JSON.stringify({
          ok: true,
          deletedAuditId: payload.auditId,
          deletedSummaryRows: deleteResult.deletedSummaryRows,
          deletedItemRows: deleteResult.deletedItemRows,
          archived: true
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    validatePayload_(payload);
    var normalizedItemRows = normalizeItemRows_(payload.audit, payload.sheet.itemRows || []);

    deleteRowsByAuditId_(summarySheet, payload.audit.id);
    deleteRowsByAuditId_(itemsSheet, payload.audit.id);
    appendSummaryRow_(summarySheet, payload.sheet.summaryRow);
    appendItemRows_(itemsSheet, normalizedItemRows);

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        auditId: payload.audit.id,
        uploadedPhotos: normalizedItemRows.filter(function(row) { return Boolean(row.photoUrl); }).length
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function buildStructureResponse_() {
  var spreadsheet = getSpreadsheet_();
  var calculationRules = getCalculationRules_(spreadsheet);
  var processDefinitions = getProcessDefinitions_(spreadsheet);
  var structureSheets = getStructureSheets_(spreadsheet);
  var rows = [];

  structureSheets.forEach(function(sheet) {
    rows = rows.concat(getSheetRows_(sheet));
  });

  // Compatibility with the previous single-sheet configuration. It is only read
  // while there are no per-area configuration tabs yet.
  if (structureSheets.length === 0) {
    var legacySheet = spreadsheet.getSheetByName(LEGACY_STRUCTURE_SHEET_NAME);
    if (legacySheet) {
      ensureSheetHeaders_(legacySheet, STRUCTURE_SHEET_HEADERS);
      rows = getSheetRows_(legacySheet);
    }
  }

  var scopes = {
    global: [],
    Salta: [],
    Jujuy: [],
    'Sin ubicaciÃ³n': []
  };
  var categoriesByKey = {};

  rows.forEach(function(row, rowIndex) {
    var categoryName = String(row.categoryName || '').trim();
    if (!categoryName || !parseStructureBoolean_(row.active, true)) {
      return;
    }

    var scope = normalizeStructureScope_(row.scope);
    var categoryId = String(row.categoryId || '').trim() || slugifyStructureValue_(categoryName);
    var categoryKey = scope + '::' + categoryId;
    var category = categoriesByKey[categoryKey];

    if (!category) {
      category = {
        id: categoryId,
        name: categoryName,
        description: String(row.categoryDescription || '').trim(),
        staffOptions: splitStructureList_(row.staffOptions),
        items: []
      };
      categoriesByKey[categoryKey] = category;
      scopes[scope].push(category);
    }

    var question = String(row.question || '').trim();
    if (!question) {
      return;
    }

    var order = parseStructureNumber_(row.order, category.items.length + 1);
    category.items.push({
      id: String(row.itemId || '').trim() || (categoryId + '-' + (rowIndex + 1)),
      text: question,
      required: parseStructureBoolean_(row.required, false),
      block: String(row.block || '').trim() || 'General',
      priority: normalizeStructurePriority_(row.priority),
      guidance: String(row.guidance || '').trim(),
      requiresCommentOnFail: parseStructureBoolean_(row.requiresCommentOnFail, false),
      description: String(row.description || '').trim(),
      responsibleRoles: normalizeResponsibleRoles_(row.responsibleRoles),
      sector: normalizeStructureSector_(row.sector),
      allowsNa: normalizeStructureResponseType_(row.responseType, row.allowsNa) === 'si_no_na',
      calculationMode: normalizeCalculationMode_(row.calculationMode),
      weight: Math.max(0.01, parseStructureNumber_(row.weight, 1)),
      order: order,
      active: true,
      scoreLinks: parseStructureScoreLinks_(row.scoreLinks),
      scoreAreas: parseStructureScoreLinks_(row.scoreLinks).map(function(link) { return link.area; })
    });
  });

  Object.keys(scopes).forEach(function(scope) {
    scopes[scope].forEach(function(category) {
      category.items.sort(function(left, right) {
        return Number(left.order || 0) - Number(right.order || 0);
      });
    });
  });

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: 'audit-structure',
      version: '1.0',
      sheetPrefix: STRUCTURE_SHEET_PREFIX,
      sheetNames: structureSheets.map(function(sheet) { return sheet.getName(); }),
      calculationRules: calculationRules,
      processDefinitions: processDefinitions,
      scopes: scopes
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function replaceStructureScope_(spreadsheet, payload) {
  if (!payload || !payload.scope) {
    throw new Error('Payload invalido: scope de estructura requerido.');
  }

  if (!Array.isArray(payload.categories) || payload.categories.length === 0) {
    throw new Error('Payload invalido: se requiere al menos un area para guardar.');
  }

  var scope = normalizeStructureScope_(payload.scope);
  var sheetNamesInPayload = {};
  var itemCount = 0;

  payload.categories.forEach(function(category, categoryIndex) {
    var categoryName = String((category && category.name) || '').trim();
    if (!categoryName) {
      throw new Error('Cada area debe tener un nombre. Error en la posicion ' + (categoryIndex + 1) + '.');
    }

    var structureSheet = getOrCreateStructureSheet_(spreadsheet, categoryName);
    var sheetName = structureSheet.getName();
    sheetNamesInPayload[sheetName] = true;

    var preservedRows = getSheetRows_(structureSheet).filter(function(row) {
      return normalizeStructureScope_(row.scope) !== scope;
    });
    var categoryRows = buildStructureRows_(scope, [category]);
    replaceStructureSheetRows_(structureSheet, preservedRows.concat(categoryRows));
    itemCount += categoryRows.filter(function(row) {
      return Boolean(String(row.question || '').trim());
    }).length;
  });

  // Removing an area from the app only clears this saved scope. The tab and
  // configurations for other locations remain available.
  getStructureSheets_(spreadsheet).forEach(function(structureSheet) {
    if (sheetNamesInPayload[structureSheet.getName()]) {
      return;
    }

    var preservedRows = getSheetRows_(structureSheet).filter(function(row) {
      return normalizeStructureScope_(row.scope) !== scope;
    });
    replaceStructureSheetRows_(structureSheet, preservedRows);
  });

  return {
    scope: scope,
    categoryCount: payload.categories.length,
    itemCount: itemCount
  };
}

function getStructureSheets_(spreadsheet) {
  return spreadsheet.getSheets().filter(function(sheet) {
    return sheet.getName().indexOf(STRUCTURE_SHEET_PREFIX) === 0;
  }).map(function(sheet) {
    ensureSheetHeaders_(sheet, STRUCTURE_SHEET_HEADERS);
    return sheet;
  });
}

function getOrCreateStructureSheet_(spreadsheet, categoryName) {
  return getOrCreateSheet_(
    spreadsheet,
    getStructureSheetName_(categoryName),
    STRUCTURE_SHEET_HEADERS
  );
}

function getStructureSheetName_(categoryName) {
  var safeName = String(categoryName || '')
    .replace(/[\\\\/:*?\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Sin nombre';
  return (STRUCTURE_SHEET_PREFIX + safeName).slice(0, 99);
}

function replaceStructureSheetRows_(structureSheet, rows) {
  if (structureSheet.getLastRow() > 1) {
    structureSheet.getRange(2, 1, structureSheet.getLastRow() - 1, structureSheet.getLastColumn()).clearContent();
  }
  appendObjectRows_(structureSheet, rows);
}
function getCalculationRules_(spreadsheet) {
  var rulesSheet = getOrCreateSheet_(spreadsheet, CALCULATION_RULES_SHEET_NAME, CALCULATION_RULES_HEADERS);
  return getSheetRows_(rulesSheet).filter(function(row) {
    return parseStructureBoolean_(row.active, true);
  }).map(function(row, index) {
    return {
      id: String(row.id || '').trim() || ('regla-' + (index + 1)),
      scope: normalizeStructureScope_(row.scope),
      active: true,
      targetArea: String(row.targetArea || '').trim(),
      targetItemId: String(row.targetItemId || '').trim(),
      sourceType: normalizeCalculationSourceType_(row.sourceType),
      sourceArea: String(row.sourceArea || '').trim(),
      sourceItemId: String(row.sourceItemId || '').trim(),
      sourceRole: normalizeCalculationSourceRole_(row.sourceRole),
      method: normalizeCalculationMethod_(row.method),
      sourceWeight: Math.max(0.01, parseStructureNumber_(row.sourceWeight, 1)),
      minimumCoverage: parseCalculationCoverage_(row.minimumCoverage),
      detail: String(row.detail || '').trim()
    };
  }).filter(function(rule) {
    if (!rule.targetArea || !rule.targetItemId) {
      return false;
    }
    if (rule.sourceType === 'or_role') {
      return Boolean(rule.sourceRole);
    }
    if (rule.sourceType === 'or_total') {
      return true;
    }
    if (rule.sourceType === 'or_question') {
      return Boolean(rule.sourceItemId);
    }
    return Boolean(rule.sourceArea && rule.sourceItemId);
  });
}

function replaceCalculationRulesScope_(rulesSheet, payload) {
  if (!payload || !payload.scope || !Array.isArray(payload.rules)) {
    throw new Error('Payload invalido: se requieren scope y rules.');
  }

  var scope = normalizeStructureScope_(payload.scope);
  var preservedRows = getSheetRows_(rulesSheet).filter(function(row) {
    return normalizeStructureScope_(row.scope) !== scope;
  });
  var nextRows = preservedRows.concat(buildCalculationRuleRows_(scope, payload.rules));
  replaceStructureSheetRows_(rulesSheet, nextRows);

  return { scope: scope, ruleCount: nextRows.filter(function(row) {
    return normalizeStructureScope_(row.scope) === scope;
  }).length };
}

function buildCalculationRuleRows_(scope, rules) {
  return rules.map(function(rule, index) {
    return {
      active: rule && rule.active === false ? 'no' : 'si',
      scope: scope,
      id: String((rule && rule.id) || '').trim() || ('regla-' + (index + 1)),
      targetArea: String((rule && rule.targetArea) || '').trim(),
      targetItemId: String((rule && rule.targetItemId) || '').trim(),
      sourceType: normalizeCalculationSourceType_(rule && rule.sourceType),
      sourceArea: String((rule && rule.sourceArea) || '').trim(),
      sourceItemId: String((rule && rule.sourceItemId) || '').trim(),
      sourceRole: String((rule && rule.sourceRole) || '').trim(),
      method: normalizeCalculationMethod_(rule && rule.method),
      sourceWeight: Math.max(0.01, Number((rule && rule.sourceWeight) || 1)),
      minimumCoverage: parseCalculationCoverage_(rule && rule.minimumCoverage),
      detail: String((rule && rule.detail) || '').trim()
    };
  });
}

function getProcessDefinitions_(spreadsheet) {
  var processSheet = getOrCreateSheet_(spreadsheet, PROCESS_DEFINITIONS_SHEET_NAME, PROCESS_DEFINITIONS_HEADERS);
  return getSheetRows_(processSheet).filter(function(row) {
    return parseStructureBoolean_(row.active, true);
  }).map(function(row, index) {
    return {
      id: String(row.id || '').trim() || ('proceso-' + (index + 1)),
      scope: normalizeStructureScope_(row.scope),
      active: true,
      name: String(row.name || '').trim(),
      areas: splitStructureList_(row.areas),
      weights: splitCalculationNumbers_(row.weights),
      minimumCoverage: parseCalculationCoverage_(row.minimumCoverage),
      order: Math.max(0, parseStructureNumber_(row.order, index + 1))
    };
  }).filter(function(definition) {
    return Boolean(definition.name && definition.areas.length);
  });
}

function replaceProcessDefinitionsScope_(processSheet, payload) {
  if (!payload || !payload.scope || !Array.isArray(payload.definitions)) {
    throw new Error('Payload inválido: se requieren scope y definitions.');
  }

  var scope = normalizeStructureScope_(payload.scope);
  var preservedRows = getSheetRows_(processSheet).filter(function(row) {
    return normalizeStructureScope_(row.scope) !== scope;
  });
  var nextRows = preservedRows.concat(buildProcessDefinitionRows_(scope, payload.definitions));
  replaceStructureSheetRows_(processSheet, nextRows);

  return { scope: scope, processCount: nextRows.filter(function(row) {
    return normalizeStructureScope_(row.scope) === scope;
  }).length };
}

function buildProcessDefinitionRows_(scope, definitions) {
  return definitions.map(function(definition, index) {
    var areas = Array.isArray(definition && definition.areas) ? definition.areas : [];
    var weights = Array.isArray(definition && definition.weights) ? definition.weights : [];
    return {
      active: definition && definition.active === false ? 'no' : 'si',
      scope: scope,
      id: String((definition && definition.id) || '').trim() || ('proceso-' + (index + 1)),
      name: String((definition && definition.name) || '').trim(),
      areas: areas.map(function(area) { return String(area || '').trim(); }).filter(Boolean).join(', '),
      weights: weights.map(function(weight) { return Math.max(0.01, Number(weight || 1)); }).join(', '),
      minimumCoverage: parseCalculationCoverage_(definition && definition.minimumCoverage),
      order: Math.max(0, parseStructureNumber_(definition && definition.order, index + 1))
    };
  });
}

function splitCalculationNumbers_(value) {
  return String(value || '').split(/[,;|]/).map(function(entry) {
    return Math.max(0.01, parseStructureNumber_(entry, 1));
  }).filter(function(entry) {
    return isFinite(entry);
  });
}

function getProcessDefinitions_(spreadsheet) {
  var processSheet = getOrCreateSheet_(spreadsheet, PROCESS_DEFINITIONS_SHEET_NAME, PROCESS_DEFINITIONS_HEADERS);
  return getSheetRows_(processSheet).filter(function(row) {
    return parseStructureBoolean_(row.active, true);
  }).map(function(row, index) {
    return {
      id: String(row.id || '').trim() || ('proceso-' + (index + 1)),
      scope: normalizeStructureScope_(row.scope),
      active: true,
      name: String(row.name || '').trim(),
      areas: splitStructureList_(row.areas),
      weights: splitCalculationNumbers_(row.weights),
      minimumCoverage: parseCalculationCoverage_(row.minimumCoverage),
      order: Math.max(0, parseStructureNumber_(row.order, index + 1))
    };
  }).filter(function(definition) {
    return Boolean(definition.name && definition.areas.length);
  });
}

function replaceProcessDefinitionsScope_(processSheet, payload) {
  if (!payload || !payload.scope || !Array.isArray(payload.definitions)) {
    throw new Error('Payload inválido: se requieren scope y definitions.');
  }

  var scope = normalizeStructureScope_(payload.scope);
  var preservedRows = getSheetRows_(processSheet).filter(function(row) {
    return normalizeStructureScope_(row.scope) !== scope;
  });
  var nextRows = preservedRows.concat(buildProcessDefinitionRows_(scope, payload.definitions));
  replaceStructureSheetRows_(processSheet, nextRows);

  return { scope: scope, processCount: nextRows.filter(function(row) {
    return normalizeStructureScope_(row.scope) === scope;
  }).length };
}

function buildProcessDefinitionRows_(scope, definitions) {
  return definitions.map(function(definition, index) {
    var areas = Array.isArray(definition && definition.areas) ? definition.areas : [];
    var weights = Array.isArray(definition && definition.weights) ? definition.weights : [];
    return {
      active: definition && definition.active === false ? 'no' : 'si',
      scope: scope,
      id: String((definition && definition.id) || '').trim() || ('proceso-' + (index + 1)),
      name: String((definition && definition.name) || '').trim(),
      areas: areas.map(function(area) { return String(area || '').trim(); }).filter(Boolean).join(', '),
      weights: weights.map(function(weight) { return Math.max(0.01, Number(weight || 1)); }).join(', '),
      minimumCoverage: parseCalculationCoverage_(definition && definition.minimumCoverage),
      order: Math.max(0, parseStructureNumber_(definition && definition.order, index + 1))
    };
  });
}

function splitCalculationNumbers_(value) {
  return String(value || '').split(/[,;|]/).map(function(entry) {
    return Math.max(0.01, parseStructureNumber_(entry, 1));
  }).filter(function(entry) {
    return isFinite(entry);
  });
}

function normalizeCalculationSourceType_(value) {
  var sourceType = String(value || '').trim().toLowerCase();
  if (['or_role', 'rol_or', 'resultado_rol_or'].indexOf(sourceType) !== -1) {
    return 'or_role';
  }
  if (['or_question', 'pregunta_or', 'item_or'].indexOf(sourceType) !== -1) {
    return 'or_question';
  }
  if (['or_total', 'total_or', 'promedio_or'].indexOf(sourceType) !== -1) {
    return 'or_total';
  }
  return 'question';
}

function normalizeCalculationSourceRole_(value) {
  var role = String(value || '').trim().toLowerCase();
  return ['asesor', 'tecnico', 'controller', 'lavador', 'repuestos'].indexOf(role) !== -1 ? role : '';
}

function normalizeCalculationMethod_(value) {
  var method = String(value || '').trim().toLowerCase();
  return method === 'promedio_por_auditoria' ? 'promedio_por_auditoria' : 'promedio_por_colaborador';
}

function parseCalculationCoverage_(value) {
  var parsed = Number(String(value === undefined || value === null ? '' : value).trim().replace(',', '.'));
  return isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 100;
}
function buildStructureRows_(scope, categories) {
  return categories.flatMap(function(category, categoryIndex) {
    var categoryId = String((category && category.id) || '').trim() || ('area-' + (categoryIndex + 1));
    var categoryName = String((category && category.name) || '').trim();
    if (!categoryName) {
      return [];
    }

    var categoryDescription = String((category && category.description) || '').trim();
    var staffOptions = Array.isArray(category.staffOptions) ? category.staffOptions.join(', ') : '';
    var items = Array.isArray(category.items) && category.items.length > 0 ? category.items : [null];

    return items.map(function(item, itemIndex) {
      var hasItem = Boolean(item && String(item.text || '').trim());
      var scoreLinks = hasItem && Array.isArray(item.scoreLinks) ? JSON.stringify(item.scoreLinks) : '';
      return {
        scope: scope,
        categoryId: categoryId,
        categoryName: categoryName,
        categoryDescription: categoryDescription,
        staffOptions: staffOptions,
        itemId: hasItem ? (String(item.id || '').trim() || (categoryId + '-' + (itemIndex + 1))) : '',
        order: hasItem ? Number(item.order || (itemIndex + 1)) : '',
        block: hasItem ? String(item.block || 'General') : '',
        question: hasItem ? String(item.text || '').trim() : '',
        description: hasItem ? String(item.description || '') : '',
        weight: hasItem ? Math.max(0.01, Number(item.weight || 1)) : '',
        required: hasItem && item.required ? 'si' : 'no',
        allowsNa: !hasItem || item.allowsNa !== false ? 'si' : 'no',
        responseType: !hasItem ? '' : (item.allowsNa === false ? 'si_no' : 'si_no_na'),
        calculationMode: !hasItem ? 'manual' : (item.calculationMode === 'calculated' ? 'calculado' : 'manual'),
        active: !hasItem || item.active !== false ? 'si' : 'no',
        requiresCommentOnFail: hasItem && item.requiresCommentOnFail ? 'si' : 'no',
        priority: hasItem ? String(item.priority || 'medium') : '',
        guidance: hasItem ? String(item.guidance || '') : '',
        sector: hasItem ? String(item.sector || 'resumen') : '',
        responsibleRoles: hasItem && Array.isArray(item.responsibleRoles) ? item.responsibleRoles.join(',') : '',
        scoreLinks: scoreLinks
      };
    });
  });
}
function normalizeStructureScope_(value) {
  var scope = String(value || '').trim();
  if (scope === 'Salta' || scope === 'Jujuy' || scope === 'Sin ubicación') {
    return scope;
  }

  return 'global';
}

function normalizeStructureResponseType_(value, allowsNaValue) {
  var responseType = String(value || '').trim().toLowerCase();
  if (['si_no', 'yes_no', 'si/no', 'sí/no'].indexOf(responseType) !== -1) {
    return 'si_no';
  }

  if (['si_no_na', 'yes_no_na', 'si/no/n/a', 'sí/no/n/a'].indexOf(responseType) !== -1) {
    return 'si_no_na';
  }

  return parseStructureBoolean_(allowsNaValue, true) ? 'si_no_na' : 'si_no';
}
function normalizeCalculationMode_(value) {
  var mode = String(value || '').trim().toLowerCase();
  return ['calculado', 'calculated', 'automatico', 'automático'].indexOf(mode) !== -1
    ? 'calculated'
    : 'manual';
}
function parseStructureBoolean_(value, fallback) {
  var normalized = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['si', 'sí', 'true', '1', 'x', 'yes', 'activo'].indexOf(normalized) !== -1) {
    return true;
  }

  if (['no', 'false', '0', 'inactivo'].indexOf(normalized) !== -1) {
    return false;
  }

  return fallback;
}

function parseStructureNumber_(value, fallback) {
  var normalized = String(value === undefined || value === null ? '' : value).trim().replace(',', '.');
  var parsed = Number(normalized);
  return isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function splitStructureList_(value) {
  return String(value || '')
    .split(/[;,|]/)
    .map(function(entry) { return entry.trim(); })
    .filter(Boolean);
}

function normalizeResponsibleRoles_(value) {
  var allowed = ['asesor', 'tecnico', 'controller', 'lavador', 'repuestos'];
  return splitStructureList_(value).filter(function(role) {
    return allowed.indexOf(role.toLowerCase()) !== -1;
  }).map(function(role) {
    return role.toLowerCase();
  });
}

function normalizeStructurePriority_(value) {
  var priority = String(value || '').trim().toLowerCase();
  return priority === 'high' || priority === 'low' || priority === 'medium' ? priority : 'medium';
}

function normalizeStructureSector_(value) {
  var allowed = ['recepcion', 'taller', 'control_calidad', 'lavado', 'repuestos', 'resumen'];
  var sector = String(value || '').trim().toLowerCase();
  return allowed.indexOf(sector) !== -1 ? sector : 'resumen';
}

function parseStructureScoreLinks_(value) {
  var rawValue = String(value || '').trim();
  if (!rawValue) {
    return [];
  }

  try {
    var parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(function(link) {
      return {
        area: String((link && link.area) || '').trim(),
        weight: Math.max(1, parseStructureNumber_(link && link.weight, 100)),
        destinationItemId: String((link && link.destinationItemId) || '').trim(),
        destinationItemText: String((link && link.destinationItemText) || '').trim()
      };
    }).filter(function(link) {
      return Boolean(link.area);
    });
  } catch (error) {
    return rawValue.split(';').map(function(entry) {
      var parts = entry.split('|');
      return {
        area: String(parts[0] || '').trim(),
        weight: Math.max(1, parseStructureNumber_(parts[1], 100)),
        destinationItemId: String(parts[2] || '').trim(),
        destinationItemText: String(parts[3] || '').trim()
      };
    }).filter(function(link) {
      return Boolean(link.area);
    });
  }
}

function slugifyStructureValue_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'area';
}
function getSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  return SpreadsheetApp.getActiveSpreadsheet();
}

function buildHistoryResponse_(e) {
  var limit = parseInt((e && e.parameter && e.parameter.limit) || '200', 10);
  if (!limit || limit < 1) {
    limit = 200;
  }

  var spreadsheet = getSpreadsheet_();
  var summarySheet = getOrCreateSheet_(spreadsheet, SUMMARY_SHEET_NAME, [
    'auditId',
    'submittedAt',
    'auditDate',
    'auditBatchName',
    'sampleTarget',
    'selectedStaffNames',
    'location',
    'auditorId',
    'auditorName',
    'role',
    'staffName',
    'orderNumber',
    'totalScore',
    'passCount',
    'failCount',
    'naCount',
    'answeredCount',
    'itemsCount',
    'notes',
    'submittedByEmail',
    'asesorServicio',
    'tecnico',
    'controller',
    'lavador',
    'repuestos',
    'entityType'
  ]);
  var itemsSheet = getOrCreateSheet_(spreadsheet, ITEMS_SHEET_NAME, [
    'auditId',
    'submittedAt',
    'auditDate',
    'auditBatchName',
    'location',
    'auditorName',
    'role',
    'staffName',
    'questionIndex',
    'question',
      'description',
      'sector',
      'responsibleRoles',
      'scoreAreas',
      'scoreLinks',
      'weight',
      'allowsNa',
      'status',
    'statusLabel',
    'comment',
    'photoUrl'
  ]);

  var summaryRows = getSheetRows_(summarySheet)
    .sort(function(left, right) {
      var leftKey = String(left.submittedAt || left.auditDate || '');
      var rightKey = String(right.submittedAt || right.auditDate || '');
      return rightKey.localeCompare(leftKey);
    })
    .slice(0, limit);
  var auditIds = summaryRows.map(function(row) { return row.auditId; });
  var itemRows = getSheetRows_(itemsSheet)
    .filter(function(row) { return auditIds.indexOf(row.auditId) !== -1; })
    .sort(function(left, right) {
      if (left.auditId === right.auditId) {
        return Number(left.questionIndex || 0) - Number(right.questionIndex || 0);
      }

      return String(left.auditId || '').localeCompare(String(right.auditId || ''));
    });

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: 'audit-sync',
      version: '1.0',
      summaryRows: summaryRows,
      itemRows: itemRows
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_(spreadsheet, sheetName, headers) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  ensureSheetHeaders_(sheet, headers);

  return sheet;
}

function ensureSheetHeaders_(sheet, headers) {
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  var missingHeaders = headers.filter(function(header) {
    return currentHeaders.indexOf(header) === -1;
  });

  if (missingHeaders.length === 0) {
    return;
  }

  sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  sheet.setFrozenRows(1);
}

function getSheetRows_(sheet) {
  if (sheet.getLastRow() <= 1) {
    return [];
  }

  var values = sheet.getDataRange().getDisplayValues();
  var headers = values[0];

  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== ''; });
  }).map(function(row) {
    var mapped = {};
    headers.forEach(function(header, index) {
      var fieldName = normalizeSheetHeader_(header);
      var value = row[index] || '';
      // If an older tab has both the old and the Spanish header, keep the
      // populated value instead of replacing it with an empty duplicate.
      if (mapped[fieldName] === undefined || value !== '') {
        mapped[fieldName] = value;
      }
    });
    return mapped;
  });
}

function normalizeSheetHeader_(header) {
  return STRUCTURE_SHEET_HEADER_KEYS[header] || CALCULATION_RULES_HEADER_KEYS[header] || PROCESS_DEFINITIONS_HEADER_KEYS[header] || STOCK_CONTROL_HEADER_KEYS[header] || header;
}
function appendSummaryRow_(sheet, row) {
  appendObjectRows_(sheet, [row]);
}

function appendItemRows_(sheet, rows) {
  if (!rows.length) {
    return;
  }

  appendObjectRows_(sheet, rows);
}

function appendObjectRows_(sheet, rows) {
  if (!rows.length) {
    return;
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  var values = rows.map(function(row) {
    return headers.map(function(header) {
      var fieldName = normalizeSheetHeader_(header);
      if (fieldName === 'entityType') {
        return row[fieldName] || 'general';
      }

      if (fieldName === 'weight') {
        return row[fieldName] || 1;
      }

      if (fieldName === 'allowsNa') {
        return row[fieldName] || 'true';
      }

      return row[fieldName] === 0 ? 0 : (row[fieldName] || '');
    });
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
}
function normalizeItemRows_(audit, rows) {
  return rows.map(function(row) {
    var normalizedRow = copyObject_(row);
    normalizedRow.photoUrl = resolvePhotoUrl_(audit, row);
    return normalizedRow;
  });
}

function resolvePhotoUrl_(audit, row) {
  var photoUrl = String((row && row.photoUrl) || '').trim();
  if (!photoUrl) {
    return '';
  }

  if (!isDataUrl_(photoUrl)) {
    return photoUrl;
  }

  var uploadedFile = uploadPhotoToDrive_(audit, row, photoUrl);
  uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return uploadedFile.getUrl();
}

function uploadPhotoToDrive_(audit, row, dataUrl) {
  var parsedFile = parseDataUrl_(dataUrl);
  var fileName = buildPhotoFileName_(audit, row, parsedFile.extension);
  var blob = Utilities.newBlob(parsedFile.bytes, parsedFile.mimeType, fileName);
  var folder = getDriveFolder_();

  if (folder) {
    return folder.createFile(blob);
  }

  return DriveApp.createFile(blob);
}

function getDriveFolder_() {
  var folderId = PropertiesService.getScriptProperties().getProperty(DRIVE_FOLDER_ID_PROPERTY);
  if (!folderId) {
    return null;
  }

  return DriveApp.getFolderById(folderId);
}

function buildPhotoFileName_(audit, row, extension) {
  var safeAuditId = sanitizeFileName_((audit && audit.id) || 'auditoria');
  var safeQuestion = sanitizeFileName_((row && row.question) || ('item-' + ((row && row.questionIndex) || '0')));
  var questionIndex = Number((row && row.questionIndex) || 0);
  var safeIndex = questionIndex > 0 ? ('item-' + questionIndex) : 'item';
  return safeAuditId + '-' + safeIndex + '-' + safeQuestion + '.' + extension;
}

function parseDataUrl_(dataUrl) {
  var matches = String(dataUrl).match(/^data:(.*?);base64,(.*)$/);
  if (!matches) {
    throw new Error('Formato de imagen inválido para Google Drive.');
  }

  var mimeType = matches[1] || 'image/jpeg';
  var extension = mimeType.split('/')[1] || 'jpg';
  return {
    mimeType: mimeType,
    extension: extension === 'jpeg' ? 'jpg' : extension,
    bytes: Utilities.base64Decode(matches[2])
  };
}

function isDataUrl_(value) {
  return /^data:.*;base64,/i.test(String(value || ''));
}

function sanitizeFileName_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'archivo';
}

function copyObject_(value) {
  var copy = {};
  Object.keys(value || {}).forEach(function(key) {
    copy[key] = value[key];
  });
  return copy;
}

function validateDeletePayload_(payload) {
  if (!payload || payload.event !== 'audit_delete') {
    throw new Error('Payload invÃ¡lido para eliminaciÃ³n: event');
  }

  if (!payload.auditId) {
    throw new Error('Payload invÃ¡lido para eliminaciÃ³n: auditId');
  }
}

function validateStockControlPayload_(payload) {
  if (!Array.isArray(payload.stockRows) || payload.stockRows.length === 0 || payload.stockRows.length > 500) {
    throw new Error('Control físico inválido: se requieren entre 1 y 500 filas.');
  }

  payload.stockRows.forEach(function(row, index) {
    if (!row || !String(row.article || '').trim() || !String(row.systemLocation || '').trim()) {
      throw new Error('Control físico inválido en fila ' + (index + 1) + '.');
    }
    if (['si', 'no'].indexOf(String(row.locationResult || '').toLowerCase()) === -1 || ['si', 'no'].indexOf(String(row.quantityResult || '').toLowerCase()) === -1) {
      throw new Error('Cada fila del control físico debe tener respuesta Sí o No.');
    }
  });
}

function buildStockControlRows_(payload) {
  return payload.stockRows.map(function(row) {
    return {
      auditId: payload.audit.id,
      submittedAt: payload.submittedAt || '',
      auditDate: payload.audit.date || '',
      auditBatchName: payload.audit.auditBatchName || '',
      location: payload.audit.location || '',
      auditorName: payload.audit.auditorName || payload.sheet.summaryRow.auditorName || '',
      source: String(row.source || ''),
      systemLocation: String(row.systemLocation || ''),
      line: String(row.line || ''),
      article: String(row.article || ''),
      description: String(row.description || ''),
      systemStock: Number(row.systemStock || 0),
      locationResult: String(row.locationResult || '').toLowerCase() === 'si' ? 'Sí' : 'No',
      quantityResult: String(row.quantityResult || '').toLowerCase() === 'si' ? 'Sí' : 'No',
      observedLocation: String(row.observedLocation || ''),
      physicalQuantity: String(row.physicalQuantity || ''),
      comment: String(row.comment || '')
    };
  });
}

function deleteStockControlRows_(sheet, auditId) {
  if (!auditId || sheet.getLastRow() <= 1) {
    return 0;
  }

  var values = sheet.getDataRange().getDisplayValues();
  var auditIdIndex = (values[0] || []).indexOf('ID de control');
  if (auditIdIndex === -1) {
    throw new Error('La hoja ' + sheet.getName() + ' no contiene la columna ID de control.');
  }

  var deletedRows = 0;
  for (var rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    if (String(values[rowIndex][auditIdIndex] || '').trim() === String(auditId).trim()) {
      sheet.deleteRow(rowIndex + 1);
      deletedRows += 1;
    }
  }
  return deletedRows;
}

function deleteRowsByAuditId_(sheet, auditId) {
  if (!auditId || sheet.getLastRow() <= 1) {
    return 0;
  }

  var values = sheet.getDataRange().getDisplayValues();
  var headers = values[0] || [];
  var auditIdIndex = headers.indexOf('auditId');
  if (auditIdIndex === -1) {
    throw new Error('La hoja ' + sheet.getName() + ' no contiene la columna auditId.');
  }

  var deletedRows = 0;
  for (var rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    if (String(values[rowIndex][auditIdIndex] || '').trim() === String(auditId).trim()) {
      sheet.deleteRow(rowIndex + 1);
      deletedRows += 1;
    }
  }

  return deletedRows;
}

function validatePayload_(payload) {
  if (!payload || ['audit_submitted', 'stock_control_submit'].indexOf(payload.event) === -1) {
    throw new Error('Payload inválido: event');
  }

  if (!payload.audit || !payload.audit.id) {
    throw new Error('Payload inválido: audit.id');
  }

  if (!payload.sheet || !payload.sheet.summaryRow) {
    throw new Error('Payload inválido: sheet.summaryRow');
  }
}

function archiveAndDeleteAudit_(summarySheet, itemsSheet, trashSheet, payload) {
  var auditId = payload.auditId;
  var deletedBy = payload.userEmail || 'Desconocido';
  var reason = payload.reason || 'Eliminación manual desde panel';
  var deletedAt = payload.deletedAt || new Date().toISOString();

  var summaryValues = summarySheet.getDataRange().getDisplayValues();
  var summaryHeaders = summaryValues[0] || [];
  var sAuditIdIdx = summaryHeaders.indexOf('auditId');
  var summaryRowFound = null;

  if (sAuditIdIdx !== -1) {
    for (var i = 1; i < summaryValues.length; i++) {
      if (String(summaryValues[i][sAuditIdIdx] || '').trim() === String(auditId).trim()) {
        summaryRowFound = summaryValues[i];
        break;
      }
    }
  }

  var deletedItemCount = 0;
  if (itemsSheet.getLastRow() > 1) {
    var itemValues = itemsSheet.getDataRange().getDisplayValues();
    var itemHeaders = itemValues[0] || [];
    var iAuditIdIdx = itemHeaders.indexOf('auditId');
    if (iAuditIdIdx !== -1) {
      for (var j = 1; j < itemValues.length; j++) {
        if (String(itemValues[j][iAuditIdIdx] || '').trim() === String(auditId).trim()) {
          deletedItemCount++;
        }
      }
    }
  }

  // Guardar en la hoja de Papelera_Auditorias para respaldo y trazabilidad
  if (trashSheet) {
    trashSheet.appendRow([
      deletedAt,
      deletedBy,
      reason,
      auditId,
      summaryRowFound ? JSON.stringify(summaryRowFound) : 'No encontrada en resumen',
      deletedItemCount
    ]);
  }

  var delSummary = deleteRowsByAuditId_(summarySheet, auditId);
  var delItems = deleteRowsByAuditId_(itemsSheet, auditId);

  return {
    deletedSummaryRows: delSummary,
    deletedItemRows: delItems
  };
}
