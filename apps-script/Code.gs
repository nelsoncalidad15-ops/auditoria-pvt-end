var SUMMARY_SHEET_NAME = 'Auditorias';
var ITEMS_SHEET_NAME = 'AuditoriaItems';
var DRIVE_FOLDER_ID_PROPERTY = 'DRIVE_FOLDER_ID';

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.mode === 'history') {
      return buildHistoryResponse_(e);
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
      'weight',
      'allowsNa',
      'status',
      'statusLabel',
      'comment',
      'photoUrl'
    ]);

    if (payload && payload.event === 'audit_delete') {
      validateDeletePayload_(payload);

      return ContentService
        .createTextOutput(JSON.stringify({
          ok: true,
          deletedAuditId: payload.auditId,
          deletedSummaryRows: deleteRowsByAuditId_(summarySheet, payload.auditId),
          deletedItemRows: deleteRowsByAuditId_(itemsSheet, payload.auditId)
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    validatePayload_(payload);
    var normalizedItemRows = normalizeItemRows_(payload.audit, payload.sheet.itemRows || []);

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
      mapped[header] = row[index] || '';
    });
    return mapped;
  });
}

function appendSummaryRow_(sheet, row) {
  sheet.appendRow([
    row.auditId || '',
    row.submittedAt || '',
    row.auditDate || '',
    row.auditBatchName || '',
    row.location || '',
    row.auditorId || '',
    row.auditorName || '',
    row.role || '',
    row.staffName || '',
    row.orderNumber || '',
    row.totalScore || 0,
    row.passCount || 0,
    row.failCount || 0,
    row.naCount || 0,
    row.answeredCount || 0,
    row.itemsCount || 0,
    row.notes || '',
    row.submittedByEmail || '',
    row.asesorServicio || '',
    row.tecnico || '',
    row.controller || '',
    row.lavador || '',
    row.repuestos || '',
    row.entityType || 'general'
  ]);
}

function appendItemRows_(sheet, rows) {
  if (!rows.length) {
    return;
  }

  var values = rows.map(function(row) {
    return [
      row.auditId || '',
      row.submittedAt || '',
      row.auditDate || '',
      row.auditBatchName || '',
      row.location || '',
      row.auditorName || '',
      row.role || '',
      row.staffName || '',
      row.questionIndex || 0,
      row.question || '',
      row.description || '',
      row.sector || '',
      row.responsibleRoles || '',
      row.weight || 1,
      row.allowsNa || 'true',
      row.status || '',
      row.statusLabel || '',
      row.comment || '',
      row.photoUrl || ''
    ];
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
  if (!payload || payload.event !== 'audit_submitted') {
    throw new Error('Payload inválido: event');
  }

  if (!payload.audit || !payload.audit.id) {
    throw new Error('Payload inválido: audit.id');
  }

  if (!payload.sheet || !payload.sheet.summaryRow) {
    throw new Error('Payload inválido: sheet.summaryRow');
  }
}
