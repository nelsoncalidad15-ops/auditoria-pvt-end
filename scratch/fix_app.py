
import os

app_path = r'c:\Users\usuario\Desktop\Autosol Jujuy\pagina web\Auditoria PVT - copia\src\App.tsx'

with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Look for the corrupted part:
# 2003:                     formatPreDeliveryLegajoQuestion={formatPreDeliveryLegajoQuestion}
# 2004:                   />
# 2005:                   newCategoryDescription={newCategoryDescription}

found_index = -1
for i, line in enumerate(lines):
    if 'formatPreDeliveryLegajoQuestion={formatPreDeliveryLegajoQuestion}' in line:
        if i + 1 < len(lines) and '/>' in lines[i+1]:
            found_index = i
            break

if found_index == -1:
    print("Could not find anchor point.")
    exit(1)

print(f"Found anchor at line {found_index + 1}")

# We want to replace from found_index + 2 (the line after />)
# up to the line that starts with 'newCategoryDescription' (or whatever is currently there)

insertion_point = found_index + 2

restored_block = [
    '                </Suspense>\n',
    '              )}\n',
    '            </motion.div>\n',
    '          )}\n',
    '\n',
    '          {view === "structure" && canAccessStructure && (\n',
    '            <motion.div\n',
    '              key="structure"\n',
    '              initial={{ opacity: 0, x: 20 }}\n',
    '              animate={{ opacity: 1, x: 0 }}\n',
    '              exit={{ opacity: 0, x: -20 }}\n',
    '              className="space-y-6 pb-12"\n',
    '            >\n',
    '              <Suspense fallback={<div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando estructura...</div>}>\n',
    '                <StructurePanel\n',
    '                  selectedStructureScope={selectedStructureScope}\n',
    '                  setSelectedStructureScope={setSelectedStructureScope}\n',
    '                  structureStorageLabel={structureStorageLabel}\n',
    '                  isLoadingStructureFromCloud={isLoadingStructureFromCloud}\n',
    '                  isSavingStructureToCloud={isSavingStructureToCloud}\n',
    '                  handleLoadStructureFromCloud={handleLoadStructureFromCloud}\n',
    '                  handleSaveStructureToCloud={handleSaveStructureToCloud}\n',
    '                  handleResetStructure={handleResetStructure}\n',
    '                  auditCategories={auditCategories}\n',
    '                  selectedStructureCategory={selectedStructureCategory}\n',
    '                  selectedStructureCategoryId={selectedStructureCategoryId}\n',
    '                  setSelectedStructureCategoryId={setSelectedStructureCategoryId}\n',
    '                  updateCategory={updateCategory}\n',
    '                  handleDuplicateCategory={handleDuplicateCategory}\n',
    '                  handleDeleteCategory={handleDeleteCategory}\n',
    '                  handleDuplicateItem={handleDuplicateItem}\n',
    '                  handleDeleteItem={handleDeleteItem}\n',
    '                  newCategoryName={newCategoryName}\n',
    '                  setNewCategoryName={setNewCategoryName}\n'
]

# Identify how much was deleted. 
# Currently after /> it shows:
# 2005:                   newCategoryDescription={newCategoryDescription}

# We should replace lines until we find 'newCategoryDescription'
end_index = insertion_point
while end_index < len(lines) and 'newCategoryDescription' not in lines[end_index]:
    end_index += 1

print(f"Replacing from line {insertion_point + 1} to {end_index}")

new_lines = lines[:insertion_point] + restored_block + lines[end_index:]

with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Restoration successful.")
