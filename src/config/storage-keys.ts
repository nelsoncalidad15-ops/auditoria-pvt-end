/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const QUICK_AUDIT_MODE_STORAGE_KEY = "quick-audit-mode";
export const USER_PROFILE_STORAGE_KEY = "audit-user-profile";
export const INTEGRATION_META_STORAGE_KEY = "audit-integration-meta";
export const SYNC_META_STORAGE_KEY = "audit-sync-meta";
export const EXPORT_META_STORAGE_KEY = "audit-export-meta";

/**
 * Gets a key for storing the last active item of a specific audit session.
 */
export function getLastAuditItemStorageKey(sessionId?: string) {
  if (!sessionId) {
    return null;
  }
  return `audit-last-item:${sessionId}`;
}
