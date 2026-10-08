-- ==============================================================
-- 상명건설 (Sang Myung Construct Co., Ltd.) PostgreSQL / Supabase 스키마
-- Supabase SQL Editor에 복사하여 [RUN] 버튼을 누르면 즉시 실행됩니다.
-- ==============================================================

-- 1. 관리자 계정 테이블
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) DEFAULT '최고관리자',
    email VARCHAR(150),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 관리자 계정 등록 (기존 계정 존재 시 건너뜀)
INSERT INTO admin_users (id, password, name, email, phone) 
VALUES ('admin', '1234', '최고관리자', 'admin@sangmyung.co.kr', '010-9081-3001')
ON CONFLICT (id) DO NOTHING;

-- 2. 견적 및 상담 접수 테이블
CREATE TABLE IF NOT EXISTS project_orders (
    id VARCHAR(50) PRIMARY KEY,
    date VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    structure VARCHAR(100) NOT NULL,
    stage VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(150),
    content TEXT,
    reply TEXT,
    attachment VARCHAR(255),
    password VARCHAR(100),
    payment_status VARCHAR(50) DEFAULT 'NONE',
    status VARCHAR(50) DEFAULT '미답변',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. NEWS 공사소식 테이블
CREATE TABLE IF NOT EXISTS news_articles (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    image TEXT,
    content TEXT,
    date VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 서비스 (SERVICES) 관리 테이블
CREATE TABLE IF NOT EXISTS company_services (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    image TEXT,
    content TEXT,
    date VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Q&A 1:1 고객상담 테이블
CREATE TABLE IF NOT EXISTS qna_posts (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    question TEXT NOT NULL,
    answer TEXT,
    password VARCHAR(100),
    is_secret BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT '미답변',
    date VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 검색 성능 향상을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_orders_type ON project_orders(type);
CREATE INDEX IF NOT EXISTS idx_orders_date ON project_orders(date);
CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category);
CREATE INDEX IF NOT EXISTS idx_services_category ON company_services(category);
CREATE INDEX IF NOT EXISTS idx_qna_date ON qna_posts(date);
