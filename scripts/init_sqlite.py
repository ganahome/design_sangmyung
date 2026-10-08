import os
import json
import sqlite3

def init_db():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    schema_path = os.path.join(base_dir, 'data', 'schema.sql')
    json_path = os.path.join(base_dir, 'data', 'db.json')
    sqlite_path = os.path.join(base_dir, 'data', 'database.sqlite')
    
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
        
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()
    cursor.executescript(schema_sql)
    
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        admin = data.get('admin', {})
        if admin:
            cursor.execute('''
                INSERT OR REPLACE INTO admin_users (id, password, name, email, phone)
                VALUES (?, ?, ?, ?, ?)
            ''', (admin.get('id', 'admin'), admin.get('pw', '1234'), admin.get('name', '최고관리자'), admin.get('email', ''), admin.get('phone', '')))
            
        for o in data.get('orders', []):
            cursor.execute('''
                INSERT OR REPLACE INTO project_orders (id, date, type, structure, stage, name, phone, email, content, reply, attachment, password, payment_status, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                o.get('id'), o.get('date'), o.get('type'), o.get('structure'), o.get('stage'),
                o.get('name'), o.get('phone'), o.get('email', ''), o.get('content', ''),
                o.get('reply', ''), o.get('attachment', ''), o.get('password', 'pass1234'),
                o.get('paymentStatus', 'NONE'), o.get('status', '미답변')
            ))
            
        for n in data.get('news', []):
            cursor.execute('''
                INSERT OR REPLACE INTO news_articles (id, title, category, image, content, date)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                n.get('id'), n.get('title'), n.get('category'), n.get('image', ''),
                n.get('content', ''), n.get('date')
            ))
            
        for q in data.get('qna', []):
            cursor.execute('''
                INSERT OR REPLACE INTO qna_posts (id, title, author, phone, question, answer, password, is_secret, status, date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                q.get('id'), q.get('title'), q.get('author'), q.get('phone', ''),
                q.get('question', ''), q.get('answer', ''), q.get('password', ''),
                1 if q.get('isSecret') else 0, q.get('status', '미답변'), q.get('date')
            ))
            
    conn.commit()
    conn.close()
    print(f"SQLite database initialized successfully at {sqlite_path}")

if __name__ == '__main__':
    init_db()
