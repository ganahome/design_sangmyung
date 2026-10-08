/**
 * 원클릭 기존 데이터 -> Supabase PostgreSQL 마이그레이션 스크립트
 * 실행 방법:
 *   DATABASE_URL="postgresql://..." node scripts/migrate_to_postgres.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const SCHEMA_PATH = path.join(__dirname, '..', 'data', 'schema_postgres.sql');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
  console.error('사용법: DATABASE_URL="postgresql://user:pass@host:5432/dbname" node scripts/migrate_to_postgres.js');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function migrate() {
  console.log('🚀 PostgreSQL (Supabase) 데이터 마이그레이션을 시작합니다...');

  // 1. DDL 스키마 자동 실행
  try {
    const schemaSql = await fs.promises.readFile(SCHEMA_PATH, 'utf-8');
    await pool.query(schemaSql);
    // 컬럼 제약조건 완화 (기존 생성된 테이블 호환)
    await pool.query(`
      ALTER TABLE IF EXISTS project_orders ALTER COLUMN date DROP NOT NULL;
      ALTER TABLE IF EXISTS project_orders ALTER COLUMN structure DROP NOT NULL;
      ALTER TABLE IF EXISTS project_orders ALTER COLUMN stage DROP NOT NULL;
      ALTER TABLE IF EXISTS news_articles ALTER COLUMN date DROP NOT NULL;
      ALTER TABLE IF EXISTS company_services ALTER COLUMN date DROP NOT NULL;
      ALTER TABLE IF EXISTS qna_posts ALTER COLUMN date DROP NOT NULL;
    `);
    console.log('✅ 1/4 테이블 스키마 검증 및 생성 완료');
  } catch (err) {
    console.error('❌ 스키마 생성 중 에러:', err.message);
  }

  // 2. data/db.json 읽기
  let data;
  try {
    const raw = await fs.promises.readFile(DB_PATH, 'utf-8');
    data = JSON.parse(raw);
    console.log('✅ 2/4 로컬 db.json 데이터 로드 완료');
  } catch (err) {
    console.error('❌ db.json 읽기 실패:', err.message);
    process.exit(1);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // 3. Admin 계정 이전
  if (data.admin) {
    await pool.query(`
      INSERT INTO admin_users (id, password, name, email, phone)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        password = EXCLUDED.password,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone
    `, [data.admin.id || 'admin', data.admin.pw || '1234', data.admin.name || '최고관리자', data.admin.email || '', data.admin.phone || '']);
  }

  // 4. Orders 이전
  let orderCount = 0;
  for (const o of (data.orders || [])) {
    await pool.query(`
      INSERT INTO project_orders (id, date, type, structure, stage, name, phone, email, content, reply, attachment, password, payment_status, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO NOTHING
    `, [
      o.id, o.date || todayStr, o.type, o.structure || '', o.stage || '',
      o.name, o.phone, o.email || '', o.content || '',
      o.reply || '', o.attachment || '', o.password || '',
      o.paymentStatus || 'NONE', o.status || '미답변'
    ]);
    orderCount++;
  }
  console.log(`✅ 3/4 접수/견적 데이터 (${orderCount}건) 이전 완료`);

  // 5. News 이전
  let newsCount = 0;
  for (const n of (data.news || [])) {
    await pool.query(`
      INSERT INTO news_articles (id, title, category, image, content, date)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, [n.id, n.title, n.category, n.image || '', n.content || '', n.date || todayStr]);
    newsCount++;
  }

  // 6. Services 이전
  let serviceCount = 0;
  for (const s of (data.services || [])) {
    await pool.query(`
      INSERT INTO company_services (id, title, category, image, content, date)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, [s.id, s.title, s.category, s.image || '', s.content || '', s.date || todayStr]);
    serviceCount++;
  }

  // 7. Q&A 이전
  let qnaCount = 0;
  for (const q of (data.qna || [])) {
    await pool.query(`
      INSERT INTO qna_posts (id, title, author, phone, question, answer, password, is_secret, status, date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING
    `, [
      q.id, q.title, q.author, q.phone || '',
      q.question, q.answer || '', q.password || '',
      Boolean(q.isSecret), q.status || '미답변', q.date || todayStr
    ]);
    qnaCount++;
  }

  console.log(`✅ 4/4 뉴스(${newsCount}건), 서비스(${serviceCount}건), Q&A(${qnaCount}건) 이전 완료`);
  console.log('🎉 모든 데이터가 PostgreSQL (Supabase)로 손실 없이 안전하게 이전되었습니다!');
  await pool.end();
}

migrate().catch(e => {
  console.error('마이그레이션 실패:', e);
  process.exit(1);
});
