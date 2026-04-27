
import os
import re

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

def fix_file(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    original = content
    for old, new in replacements.items():
        content = content.replace(old, new)
    
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

src_dir = r'c:\Users\usuario\Desktop\Autosol Jujuy\pagina web\Auditoria PVT - copia\src'
fixed_files = []

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css')):
            path = os.path.join(root, file)
            if fix_file(path):
                fixed_files.append(path)

print(f"Fixed {len(fixed_files)} files: {fixed_files}")
