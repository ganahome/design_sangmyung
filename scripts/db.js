import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const DB_PATH = path.join(rootDir, 'data', 'db.json');

// 1. Try loading from multiple possible env file locations (.env, .env.txt, etc.)
const candidateEnvFiles = [
  path.join(rootDir, '.env'),
  path.join(rootDir, '.env.txt'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '.env.txt')
];

let loadedEnvPath = null;
for (const envFile of candidateEnvFiles) {
  if (fs.existsSync(envFile)) {
    try {
      dotenv.config({ path: envFile });
      loadedEnvPath = envFile;
      break;
    } catch (_) {}
  }
}
if (!loadedEnvPath) {
  dotenv.config();
}

const { Pool } = pg;
const DEFAULT_SUPABASE_URL = 'postgresql://postgres:%23Meetza9410@db.havavqokwshbhpuqcggj.supabase.co:5432/postgres';

let rawUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

// If empty or dummy placeholder like example.com, automatically fallback to Supabase URL
if (!rawUrl || rawUrl.includes('example.com')) {
  rawUrl = DEFAULT_SUPABASE_URL;
}

const databaseUrl = rawUrl;
export const isPostgresEnabled = Boolean(databaseUrl && databaseUrl.length > 0);

export let pool = null;
if (isPostgresEnabled) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  pool.on('error', (err) => {
    console.error('[DB] ❌ PostgreSQL Pool 에러:', err.message);
  });
  pool.query(`
    ALTER TABLE company_services ADD COLUMN IF NOT EXISTS sub_title TEXT DEFAULT '';
    ALTER TABLE company_services ADD COLUMN IF NOT EXISTS intro_html TEXT DEFAULT '';
  `).catch(() => {});
  
  try {
    const parsedHost = new URL(databaseUrl.replace(/^postgresql:\/\//, 'http://')).host;
    console.log(`[DB] ✅ Supabase PostgreSQL 연결 완료! (호스트: ${parsedHost})`);
  } catch (_) {
    console.log('[DB] ✅ PostgreSQL (Supabase) 연결 완료!');
  }
} else {
  console.log('[DB] ℹ️ DATABASE_URL이 설정되지 않아 로컬 data/db.json 파일 모드로 실행 중입니다.');
  if (loadedEnvPath) {
    console.log(`[DB] (로드된 환경설정 파일: ${loadedEnvPath})`);
  }
}

// Read all data from either Postgres or JSON fallback
export async function getDbData() {
  if (isPostgresEnabled && pool) {
    try {
      const [adminRes, ordersRes, newsRes, servicesRes, qnaRes] = await Promise.all([
        pool.query('SELECT id, password as pw, name, email, phone FROM admin_users LIMIT 1'),
        pool.query('SELECT id, date, type, structure, stage, name, phone, email, content, reply, attachment, password, payment_status as "paymentStatus", status FROM project_orders ORDER BY date DESC, id DESC'),
        pool.query('SELECT id, title, category, image, content, date FROM news_articles ORDER BY date DESC, id DESC'),
        pool.query('SELECT id, title, category, image, content, date, COALESCE(sub_title, \'\') as "subTitle", COALESCE(intro_html, \'\') as "introHtml" FROM company_services ORDER BY date DESC, id DESC'),
        pool.query('SELECT id, title, author, phone, question, answer, password, is_secret as "isSecret", status, date FROM qna_posts ORDER BY date DESC, id DESC')
      ]);

      const admin = adminRes.rows[0] || { id: 'admin', pw: '1234', name: '최고관리자' };
      return {
        admin,
        orders: ordersRes.rows || [],
        news: newsRes.rows || [],
        services: servicesRes.rows || [],
        qna: qnaRes.rows.map(q => ({ ...q, isSecret: Boolean(q.isSecret) })) || []
      };
    } catch (err) {
      console.error('[DB] Postgres query failed, falling back to local file:', err.message);
    }
  }

  // Fallback to local db.json
  try {
    const raw = await fs.promises.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.services) parsed.services = [];
    return parsed;
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { admin: { id: 'admin', pw: '1234' }, orders: [], news: [], qna: [], services: [] };
  }
}

// Execute an upsert or write to PostgreSQL
export async function syncPostgresOrder(order) {
  if (!isPostgresEnabled || !pool) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  try {
    await pool.query(`
      INSERT INTO project_orders (id, date, type, structure, stage, name, phone, email, content, reply, attachment, password, payment_status, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date,
        type = EXCLUDED.type,
        structure = EXCLUDED.structure,
        stage = EXCLUDED.stage,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        content = EXCLUDED.content,
        reply = EXCLUDED.reply,
        attachment = EXCLUDED.attachment,
        password = EXCLUDED.password,
        payment_status = EXCLUDED.payment_status,
        status = EXCLUDED.status
    `, [
      order.id, order.date || todayStr, order.type, order.structure || '', order.stage || '',
      order.name, order.phone, order.email || '', order.content || '',
      order.reply || '', order.attachment || '', order.password || '',
      order.paymentStatus || 'NONE', order.status || '미답변'
    ]);
    console.log('[DB] ✅ Supabase project_orders 동기화 완료:', order.id);
  } catch (e) {
    console.error('[DB] ❌ Supabase project_orders 동기화 실패:', e.message);
  }
}

export async function deletePostgresOrder(id) {
  if (!isPostgresEnabled || !pool) return;
  try {
    await pool.query('DELETE FROM project_orders WHERE id = $1', [id]);
    console.log('[DB] ✅ Supabase project_orders 삭제 완료:', id);
  } catch (e) {
    console.error('[DB] ❌ Supabase project_orders 삭제 실패:', e.message);
  }
}

export async function syncPostgresNews(news) {
  if (!isPostgresEnabled || !pool) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  try {
    await pool.query(`
      INSERT INTO news_articles (id, title, category, image, content, date)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        category = EXCLUDED.category,
        image = EXCLUDED.image,
        content = EXCLUDED.content,
        date = EXCLUDED.date
    `, [news.id, news.title, news.category, news.image || '', news.content || '', news.date || todayStr]);
    console.log('[DB] ✅ Supabase news_articles 동기화 완료:', news.id);
  } catch (e) {
    console.error('[DB] ❌ Supabase news_articles 동기화 실패:', e.message);
  }
}

export async function deletePostgresNews(id) {
  if (!isPostgresEnabled || !pool) return;
  try {
    await pool.query('DELETE FROM news_articles WHERE id = $1', [id]);
    console.log('[DB] ✅ Supabase news_articles 삭제 완료:', id);
  } catch (e) {
    console.error('[DB] ❌ Supabase news_articles 삭제 실패:', e.message);
  }
}

export async function syncPostgresService(service) {
  if (!isPostgresEnabled || !pool) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  try {
    await pool.query(`
      INSERT INTO company_services (id, title, category, image, content, date, sub_title, intro_html)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        category = EXCLUDED.category,
        image = EXCLUDED.image,
        content = EXCLUDED.content,
        date = EXCLUDED.date,
        sub_title = EXCLUDED.sub_title,
        intro_html = EXCLUDED.intro_html
    `, [service.id, service.title, service.category, service.image || '', service.content || '', service.date || todayStr, service.subTitle || '', service.introHtml || '']);
    console.log('[DB] ✅ Supabase company_services 동기화 완료:', service.id);
  } catch (e) {
    console.error('[DB] ❌ Supabase company_services 동기화 실패:', e.message);
  }
}

export async function deletePostgresService(id) {
  if (!isPostgresEnabled || !pool) return;
  try {
    await pool.query('DELETE FROM company_services WHERE id = $1', [id]);
  } catch (e) {
    console.error('[DB] Failed to delete service in PostgreSQL:', e.message);
  }
}

export async function syncPostgresQna(qna) {
  if (!isPostgresEnabled || !pool) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  try {
    await pool.query(`
      INSERT INTO qna_posts (id, title, author, phone, question, answer, password, is_secret, status, date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        author = EXCLUDED.author,
        phone = EXCLUDED.phone,
        question = EXCLUDED.question,
        answer = EXCLUDED.answer,
        password = EXCLUDED.password,
        is_secret = EXCLUDED.is_secret,
        status = EXCLUDED.status,
        date = EXCLUDED.date
    `, [
      qna.id, qna.title, qna.author, qna.phone || '',
      qna.question, qna.answer || '', qna.password || '',
      Boolean(qna.isSecret), qna.status || '미답변', qna.date || todayStr
    ]);
    console.log('[DB] ✅ Supabase qna_posts 동기화 완료:', qna.id);
  } catch (e) {
    console.error('[DB] ❌ Supabase qna_posts 동기화 실패:', e.message);
  }
}

export async function deletePostgresQna(id) {
  if (!isPostgresEnabled || !pool) return;
  try {
    await pool.query('DELETE FROM qna_posts WHERE id = $1', [id]);
  } catch (e) {
    console.error('[DB] Failed to delete qna in PostgreSQL:', e.message);
  }
}

export async function syncPostgresAdmin(admin) {
  if (!isPostgresEnabled || !pool) return;
  try {
    await pool.query(`
      INSERT INTO admin_users (id, password, name, email, phone)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        password = EXCLUDED.password,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        updated_at = NOW()
    `, [admin.id || 'admin', admin.pw || '1234', admin.name || '최고관리자', admin.email || '', admin.phone || '']);
  } catch (e) {
    console.error('[DB] Failed to update admin in PostgreSQL:', e.message);
  }
}
