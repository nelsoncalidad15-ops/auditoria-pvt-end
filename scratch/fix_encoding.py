
import os

def fix_encoding(text):
    replacements = {
        'Ã¡': 'á',
        'Ã©': 'é',
        'Ã­': 'í',
        'Ã³': 'ó',
        'Ãº': 'ú',
        'Ã±': 'ñ',
        'Ã\u0081': 'Á',
        'Ã\u0089': 'É',
        'Ã\u008d': 'Í',
        'Ã\u0093': 'Ó',
        'Ã\u009a': 'Ú',
        'Ã\u0091': 'Ñ',
        '?reas': 'Áreas',
        'Eleg?': 'Elegí',
        'Categor?s': 'Categorías',
        'T?cnico': 'Técnico',
        'Garant?a': 'Garantía',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text

files_to_fix = [
    r'c:\Users\usuario\Desktop\Autosol Jujuy\pagina web\Auditoria PVT - copia\src\App.tsx',
    r'c:\Users\usuario\Desktop\Autosol Jujuy\pagina web\Auditoria PVT - copia\src\components\views\AuditSessionView.tsx'
]

for file_path in files_to_fix:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        fixed_content = fix_encoding(content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print(f"Fixed encoding in {file_path}")
