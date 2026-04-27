$path = "src/App.tsx"
$lines = Get-Content $path
$component = @"
                <Suspense fallback={<div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando sesión de auditoría...</div>}>
                  <AuditSessionView
                    session={session}
                    selectedRole={selectedRole}
                    isOrdersAudit={isOrdersAudit}
                    isPreDeliveryAudit={isPreDeliveryAudit}
                    visibleAuditItems={visibleAuditItems}
                    isQuickAuditMode={isQuickAuditMode}
                    setIsQuickAuditMode={setIsQuickAuditMode}
                    draftSaveState={draftSaveState}
                    draftSaveStateLabel={draftSaveStateLabel}
                    preDeliverySection={preDeliverySection}
                    setPreDeliverySection={setPreDeliverySection}
                    activePreDeliveryLegajoCard={activePreDeliveryLegajoCard}
                    activePreDeliveryLegajoItems={activePreDeliveryLegajoItems}
                    activePreDeliveryLegajoName={activePreDeliveryLegajoName}
                    auditedFileNames={auditedFileNames}
                    activeAuditItemId={activeAuditItemId}
                    focusedAuditItemId={focusedAuditItemId}
                    activeAuditItemIndex={activeAuditItemIndex}
                    activeAuditItem={activeAuditItem}
                    activeAuditSessionItem={activeAuditSessionItem}
                    observationSuggestions={observationSuggestions}
                    isAuditChecklistCompleted={isAuditChecklistCompleted}
                    failItemsWithoutCommentCount={failItemsWithoutCommentCount}
                    optionalPendingCount={optionalPendingCount}
                    isSubmitDisabled={isSubmitDisabled}
                    isSendingToSheet={isSendingToSheet}
                    setSession={setSession}
                    focusAuditItem={focusAuditItem}
                    toggleItemStatus={toggleItemStatus}
                    updateItemComment={updateItemComment}
                    updateItemPhoto={updateItemPhoto}
                    handleAuditSubmit={handleAuditSubmit}
                    getAuditItemStatusLabel={getAuditItemStatusLabel}
                    formatPreDeliveryLegajoQuestion={formatPreDeliveryLegajoQuestion}
                  />
                </Suspense>
"@
# index 0 to 1966 is line 1 to 1967
# index 2946 is line 2947
$newContent = $lines[0..1966] + $component + $lines[2946..($lines.Count - 1)]
[System.IO.File]::WriteAllLines($path, $newContent)
