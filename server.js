import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';
import {
  isPostgresEnabled,
  getDbData,
  syncPostgresOrder,
  deletePostgresOrder,
  syncPostgresNews,
  deletePostgresNews,
  syncPostgresService,
  deletePostgresService,
  syncPostgresQna,
  deletePostgresQna,
  syncPostgresAdmin
} from './scripts/db.js';
import { uploadToSupabaseStorage } from './scripts/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const SQLITE_PATH = path.join(__dirname, 'data', 'database.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'data', 'schema.sql');
const ZIP_PATH = path.join(__dirname, 'sang_myung_backup.zip');

const UPIMAGE_DIR = path.join(__dirname, 'upimage');
const UPFILES_DIR = path.join(__dirname, 'upfiles');
if (!fs.existsSync(UPIMAGE_DIR)) fs.mkdirSync(UPIMAGE_DIR, { recursive: true });
if (!fs.existsSync(UPFILES_DIR)) fs.mkdirSync(UPFILES_DIR, { recursive: true });

// Multer Storage Configuration
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPIMAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\uac00-\ud7a3-]/g, '_');
    cb(null, `img-${Date.now()}-${cleanName}${ext}`);
  }
});
const uploadImage = multer({ storage: imageStorage, limits: { fileSize: 15 * 1024 * 1024 } });

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPFILES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\uac00-\ud7a3-]/g, '_');
    cb(null, `file-${Date.now()}-${cleanName}${ext}`);
  }
});
const uploadFile = multer({ storage: fileStorage, limits: { fileSize: 30 * 1024 * 1024 } });

// Middleware
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve Uploaded Files Statically
app.use('/upimage', express.static(UPIMAGE_DIR));
app.use('/upfiles', express.static(UPFILES_DIR));

// Helper: sync data with SQLite
function syncWithSqlite() {
  exec('python3 scripts/init_sqlite.py', (err) => {
    if (err) console.error('SQLite sync notice:', err.message);
  });
}

// Helper: sync zip archive
function refreshZipArchive() {
  exec('python3 scripts/make_zip.py', (err) => {
    if (err) console.error('Zip refresh notice:', err.message);
  });
}

// Helper: read db.json or PostgreSQL
async function readDb() {
  return await getDbData();
}

// Helper: write db.json and backup
async function writeDb(data) {
  try {
    await fs.promises.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    syncWithSqlite();
    return true;
  } catch (err) {
    console.error('Error writing db.json:', err);
    return false;
  }
}

// Masking helpers for public privacy
function maskName(name) {
  if (!name) return '익명';
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed[0] + '*';
  return trimmed[0] + '*'.repeat(trimmed.length - 2) + trimmed[trimmed.length - 1];
}

function maskPhone(phone) {
  if (!phone) return '010-****-****';
  const parts = phone.split('-');
  if (parts.length === 3) return `${parts[0]}-${parts[1].slice(0, 2)}**-****`;
  return phone.slice(0, 3) + '-****-****';
}

// ==============================================================
// 1. ORDERS API (견적문의, 유료견적문의 50만원, 상담신청)
// ==============================================================

// Public orders list: returns list with privacy protection
app.get('/api/orders', async (req, res) => {
  const db = await readDb();
  const publicList = (db.orders || []).map(o => ({
    id: o.id,
    date: o.date,
    type: o.type,
    structure: o.structure,
    stage: o.stage,
    name: maskName(o.name),
    phone: maskPhone(o.phone),
    hasPassword: Boolean(o.password),
    paymentStatus: o.paymentStatus || 'NONE',
    status: o.status || '미답변',
    attachment: o.attachment ? '첨부파일 있음' : '',
    hasReply: Boolean(o.reply && o.reply.trim()),
    // Mask details for secret protection
    isProtected: true
  }));
  res.json(publicList);
});

// Admin orders list: returns all full details
app.get('/api/orders/admin', async (req, res) => {
  const db = await readDb();
  res.json(db.orders || []);
});

// Create new order (Public inquiry / paid quote / consultation)
app.post('/api/orders', async (req, res) => {
  const db = await readDb();
  const { type, structure, stage, name, phone, email, content, password, attachment } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: '신청자명과 연락처(HP)는 필수 입력 사항입니다.' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const nextNum = (db.orders.length + 1).toString().padStart(3, '0');
  const newOrder = {
    id: `SM-${new Date().getFullYear()}-${nextNum}`,
    date: today,
    type: type || '견적문의',
    structure: structure || 'RC(철근콘크리트)구조',
    stage: stage || '건축준비중',
    name: name.trim(),
    phone: phone.trim(),
    email: (email || '').trim(),
    paymentStatus: type === '유료견적문의' ? '50만원 입금대기' : 'NONE',
    status: '미답변',
    content: (content || '').trim(),
    reply: '',
    password: (password || '').trim(),
    attachment: (attachment || '').trim()
  };

  db.orders.unshift(newOrder);
  await writeDb(db);
  await syncPostgresOrder(newOrder);
  res.status(201).json({ success: true, order: newOrder });
});

// Verify order password (for viewing full private inquiry)
app.post('/api/orders/:id/verify', async (req, res) => {
  const db = await readDb();
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: '해당 문의 내역을 찾을 수 없습니다.' });
  }

  const inputPw = (req.body.password || '').trim();
  if (!order.password || order.password === inputPw || inputPw === db.admin.pw) {
    return res.json({ success: true, order });
  }
  return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
});

// Client edit order (allowed if password matches)
app.put('/api/orders/:id/client', async (req, res) => {
  const db = await readDb();
  const idx = db.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '해당 문의 내역을 찾을 수 없습니다.' });
  }

  const existing = db.orders[idx];
  const inputPw = (req.body.password || '').trim();
  if (existing.password && existing.password !== inputPw && inputPw !== db.admin.pw) {
    return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
  }

  const { content, structure, stage, phone, email, attachment } = req.body;
  db.orders[idx] = {
    ...existing,
    content: content !== undefined ? content.trim() : existing.content,
    structure: structure || existing.structure,
    stage: stage || existing.stage,
    phone: phone ? phone.trim() : existing.phone,
    email: email !== undefined ? email.trim() : existing.email,
    attachment: attachment !== undefined ? attachment.trim() : existing.attachment
  };

  await writeDb(db);
  await syncPostgresOrder(db.orders[idx]);
  res.json({ success: true, order: db.orders[idx] });
});

// Admin update order (paymentStatus, status, reply, etc.)
app.put('/api/orders/:id', async (req, res) => {
  const db = await readDb();
  const idx = db.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
  }

  const existing = db.orders[idx];
  const { paymentStatus, status, reply, content, structure, stage, phone, email, name, attachment } = req.body;
  db.orders[idx] = {
    ...existing,
    paymentStatus: paymentStatus !== undefined ? paymentStatus : existing.paymentStatus,
    status: status !== undefined ? status : existing.status,
    reply: reply !== undefined ? reply : existing.reply,
    content: content !== undefined ? content : existing.content,
    structure: structure !== undefined ? structure : existing.structure,
    stage: stage !== undefined ? stage : existing.stage,
    phone: phone !== undefined ? phone : existing.phone,
    email: email !== undefined ? email : existing.email,
    name: name !== undefined ? name : existing.name,
    attachment: attachment !== undefined ? attachment : existing.attachment
  };

  await writeDb(db);
  await syncPostgresOrder(db.orders[idx]);
  res.json({ success: true, order: db.orders[idx] });
});

// Admin delete order
app.delete('/api/orders/:id', async (req, res) => {
  const db = await readDb();
  db.orders = db.orders.filter(o => o.id !== req.params.id);
  await writeDb(db);
  await deletePostgresOrder(req.params.id);
  res.json({ success: true });
});

// ==============================================================
// 2. NEWS API (뉴스 및 공사 보도자료)
// ==============================================================
app.get('/api/news', async (req, res) => {
  const db = await readDb();
  res.json(db.news || []);
});

app.post('/api/news', async (req, res) => {
  const db = await readDb();
  const { title, category, image, content } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: '뉴스 제목은 필수입니다.' });
  }

  const nextNum = (db.news.length + 1).toString().padStart(3, '0');
  const newNews = {
    id: `NEWS-${nextNum}`,
    title: title.trim(),
    category: category || '보도자료',
    image: image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuC42UAaultfGQ1FgDKimOEULZbstkrAoLuZfogkoIxSF-SkZ7e960OLRdyCqhNkr1CKA6CK9NlaWbnUVEfUXnm4WvNvTAsrNg5AQLwO1zTnm7lzw9QdjA6ynXoR5UouMHUpTw9jDodL1opdDKxSkQJYj1M6VFNA-khRxfvcPu8tfG-Bo_9PvBv96lgFqZqFcDynamwsV1d63sPZitvjaKoHEbFxg0ShymCoCBcSiQOlASKQqPkkpUt9Iw',
    content: (content || '').trim(),
    date: new Date().toISOString().slice(0, 10)
  };

  db.news.unshift(newNews);
  await writeDb(db);
  await syncPostgresNews(newNews);
  res.status(201).json({ success: true, news: newNews });
});

app.put('/api/news/:id', async (req, res) => {
  const db = await readDb();
  const idx = db.news.findIndex(n => n.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '뉴스를 찾을 수 없습니다.' });
  }

  db.news[idx] = { ...db.news[idx], ...req.body };
  await writeDb(db);
  await syncPostgresNews(db.news[idx]);
  res.json({ success: true, news: db.news[idx] });
});

app.delete('/api/news/:id', async (req, res) => {
  const db = await readDb();
  db.news = db.news.filter(n => n.id !== req.params.id);
  await writeDb(db);
  await deletePostgresNews(req.params.id);
  res.json({ success: true });
});

// ==============================================================
// 2-1. SERVICES API (서비스 라인업 관리: 주택건설, 상업건설, 직영건축, 추가)
// ==============================================================
app.get('/api/services', async (req, res) => {
  const db = await readDb();
  res.json(db.services || []);
});

app.get('/api/services/:id', async (req, res) => {
  const db = await readDb();
  const item = (db.services || []).find(s => s.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, message: '해당 서비스를 찾을 수 없습니다.' });
  res.json(item);
});

app.post('/api/services', async (req, res) => {
  const db = await readDb();
  if (!db.services) db.services = [];
  const { category, introHtml, subTitle, title, content, image } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: '서비스 제목은 필수 입력 사항입니다.' });
  }

  const now = new Date();
  const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const nextNum = (db.services.length + 1).toString().padStart(3, '0');
  const newService = {
    id: `SVC-${nextNum}`,
    category: (category || '주택건설').trim(),
    introHtml: (introHtml || '').trim(),
    subTitle: (subTitle || '').trim(),
    title: title.trim(),
    content: (content || '').trim(),
    image: (image || '/upimage/default_service.svg').trim(),
    createdAt: kstTime
  };

  db.services.unshift(newService);
  await writeDb(db);
  await syncPostgresService(newService);
  res.status(201).json({ success: true, service: newService });
});

app.put('/api/services/:id', async (req, res) => {
  const db = await readDb();
  if (!db.services) db.services = [];
  const idx = db.services.findIndex(s => s.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '해당 서비스를 찾을 수 없습니다.' });
  }

  db.services[idx] = { ...db.services[idx], ...req.body };
  await writeDb(db);
  await syncPostgresService(db.services[idx]);
  res.json({ success: true, service: db.services[idx] });
});

app.delete('/api/services/:id', async (req, res) => {
  const db = await readDb();
  if (!db.services) db.services = [];
  db.services = db.services.filter(s => s.id !== req.params.id);
  await writeDb(db);
  await deletePostgresService(req.params.id);
  res.json({ success: true });
});

// ==============================================================
// 3. Q&A API (고객 1:1 질의응답)
// ==============================================================
app.get('/api/qna', async (req, res) => {
  const db = await readDb();
  const publicQna = (db.qna || []).map(q => {
    if (q.isSecret) {
      return {
        id: q.id,
        title: '비공개 상담 글입니다 (작성자 및 관리자만 열람 가능)',
        author: maskName(q.author),
        date: q.date,
        isSecret: true,
        status: q.status || (q.answer ? '답변완료' : '미답변'),
        hasAnswer: Boolean(q.answer)
      };
    }
    return {
      ...q,
      author: maskName(q.author),
      phone: maskPhone(q.phone),
      password: '' // hide password
    };
  });
  res.json(publicQna);
});

// Admin Q&A full list
app.get('/api/qna/admin', async (req, res) => {
  const db = await readDb();
  res.json(db.qna || []);
});

// Verify Q&A password for viewing/editing
app.post('/api/qna/:id/verify', async (req, res) => {
  const db = await readDb();
  const q = db.qna.find(item => item.id === req.params.id);
  if (!q) {
    return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
  }

  const inputPw = (req.body.password || '').trim();
  if (!q.password || q.password === inputPw || inputPw === db.admin.pw) {
    return res.json({ success: true, qna: q });
  }
  return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
});

app.post('/api/qna', async (req, res) => {
  const db = await readDb();
  const { title, author, phone, question, isSecret, password } = req.body;
  if (!title || !author) {
    return res.status(400).json({ success: false, message: '제목과 작성자명은 필수입니다.' });
  }

  const nextNum = (db.qna.length + 1).toString().padStart(3, '0');
  const newQna = {
    id: `QNA-${nextNum}`,
    title: title.trim(),
    author: author.trim(),
    phone: (phone || '').trim(),
    question: (question || '').trim(),
    answer: '',
    password: (password || '').trim(),
    isSecret: Boolean(isSecret),
    status: '미답변',
    date: new Date().toISOString().slice(0, 10)
  };

  db.qna.unshift(newQna);
  await writeDb(db);
  await syncPostgresQna(newQna);
  res.status(201).json({ success: true, qna: newQna });
});

app.put('/api/qna/:id/client', async (req, res) => {
  const db = await readDb();
  const idx = db.qna.findIndex(q => q.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
  }

  const existing = db.qna[idx];
  const inputPw = (req.body.password || '').trim();
  if (existing.password && existing.password !== inputPw && inputPw !== db.admin.pw) {
    return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
  }

  const { title, question, phone } = req.body;
  db.qna[idx] = {
    ...existing,
    title: title !== undefined ? title.trim() : existing.title,
    question: question !== undefined ? question.trim() : existing.question,
    phone: phone !== undefined ? phone.trim() : existing.phone
  };

  await writeDb(db);
  res.json({ success: true, qna: db.qna[idx] });
});

// Admin reply / update
app.put('/api/qna/:id', async (req, res) => {
  const db = await readDb();
  const idx = db.qna.findIndex(q => q.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Q&A를 찾을 수 없습니다.' });
  }

  const existing = db.qna[idx];
  const { answer, status, title, question } = req.body;
  db.qna[idx] = {
    ...existing,
    answer: answer !== undefined ? answer : existing.answer,
    status: status !== undefined ? status : (answer ? '답변완료' : existing.status),
    title: title !== undefined ? title : existing.title,
    question: question !== undefined ? question : existing.question
  };

  await writeDb(db);
  await syncPostgresQna(db.qna[idx]);
  res.json({ success: true, qna: db.qna[idx] });
});

app.delete('/api/qna/:id', async (req, res) => {
  const db = await readDb();
  db.qna = db.qna.filter(q => q.id !== req.params.id);
  await writeDb(db);
  await deletePostgresQna(req.params.id);
  res.json({ success: true });
});

// ==============================================================
// 4. ADMIN AUTH & ACCOUNT
// ==============================================================
app.post('/api/admin/login', async (req, res) => {
  const db = await readDb();
  const { id, pw } = req.body;
  if (db.admin.id === id && db.admin.pw === pw) {
    return res.json({
      success: true,
      token: 'admin-auth-token-sm-2025',
      admin: { id: db.admin.id, name: db.admin.name || '최고관리자' }
    });
  }
  return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다. (기본: admin / 1234)' });
});

app.get('/api/admin/info', async (req, res) => {
  const db = await readDb();
  res.json({
    id: db.admin.id,
    name: db.admin.name || '최고관리자',
    email: db.admin.email || '',
    phone: db.admin.phone || ''
  });
});

app.put('/api/admin/account', async (req, res) => {
  const db = await readDb();
  const { currentPw, newId, newPw, phone, email } = req.body;

  if (currentPw && db.admin.pw !== currentPw) {
    return res.status(400).json({ success: false, message: '현재 비밀번호가 일치하지 않습니다.' });
  }

  if (newId) db.admin.id = newId.trim();
  if (newPw) db.admin.pw = newPw.trim();
  if (phone) db.admin.phone = phone.trim();
  if (email) db.admin.email = email.trim();

  await writeDb(db);
  await syncPostgresAdmin(db.admin);
  res.json({ success: true, message: '관리자 정보가 성공적으로 변경되었습니다.' });
});

// ==============================================================
// 4-1. FILE & IMAGE UPLOAD API
// ==============================================================
app.post('/api/upload/image', uploadImage.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '이미지 파일이 전송되지 않았습니다.' });
  }
  const relativePath = `/upimage/${req.file.filename}`;
  const cloudUrl = await uploadToSupabaseStorage(req.file.path, `upimage/${req.file.filename}`, req.file.mimetype);
  const finalUrl = cloudUrl || relativePath;

  res.json({
    success: true,
    url: finalUrl,
    path: finalUrl,
    filename: req.file.filename
  });
});

app.post('/api/upload/file', uploadFile.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '첨부파일이 전송되지 않았습니다.' });
  }
  const relativePath = `/upfiles/${req.file.filename}`;
  const cloudUrl = await uploadToSupabaseStorage(req.file.path, `upfiles/${req.file.filename}`, req.file.mimetype);
  const finalUrl = cloudUrl || relativePath;

  res.json({
    success: true,
    url: finalUrl,
    path: finalUrl,
    filename: req.file.originalname,
    storedFilename: req.file.filename
  });
});

app.get('/api/download-file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).send('File path required');
  const safePath = path.join(__dirname, path.normalize(filePath));
  if (fs.existsSync(safePath)) {
    const filename = req.query.name || path.basename(safePath);
    res.download(safePath, filename);
  } else {
    res.status(404).send('File not found');
  }
});

// ==============================================================
// 5. ZIP & DATABASE DOWNLOAD ENDPOINTS
// ==============================================================
app.get(['/download', '/api/download', '/download-zip'], (req, res) => {
  refreshZipArchive();
  if (fs.existsSync(ZIP_PATH)) {
    res.download(ZIP_PATH, 'sang_myung_construct_project.zip');
  } else {
    res.status(404).send('Backup ZIP file is being generated. Please refresh in a moment.');
  }
});

app.get('/api/database/sqlite', (req, res) => {
  if (fs.existsSync(SQLITE_PATH)) {
    res.download(SQLITE_PATH, 'sang_myung_database.sqlite');
  } else {
    res.status(404).send('SQLite database not found');
  }
});

app.get('/api/database/schema', (req, res) => {
  if (fs.existsSync(SCHEMA_PATH)) {
    res.download(SCHEMA_PATH, 'schema.sql');
  } else {
    res.status(404).send('Schema file not found');
  }
});

// Static files
app.use(express.static(__dirname, { extensions: ['html', 'htm'] }));

// Admin Route
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Fallback Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sang Myung Corp server running at http://0.0.0.0:${PORT}`);
  });
}

export default app;
