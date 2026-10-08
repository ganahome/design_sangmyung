import os
import zipfile

def create_backup():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    zip_path = os.path.join(base_dir, 'sang_myung_backup.zip')
    
    exclude_dirs = {'node_modules', '.git', '__pycache__', '.cache'}
    exclude_files = {'sang_myung_backup.zip', '.DS_Store', 'bun.lock'}
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(base_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if file in exclude_files or file.endswith('.pyc'):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, base_dir)
                zipf.write(full_path, rel_path)
                
    print(f"Created {zip_path} with {len(zipf.namelist())} files.")

if __name__ == '__main__':
    create_backup()
