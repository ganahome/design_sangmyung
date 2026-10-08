-- ==============================================================
-- 상명건설 (Sang Myung Construct Co., Ltd.) 데이터베이스 스키마
-- 지원 DBMS: SQLite3, MariaDB / MySQL 8.0+, PostgreSQL
-- ==============================================================

-- 1. 관리자 테이블 (Admin Credentials & Settings)
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) DEFAULT '최고관리자',
    email VARCHAR(150),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 초기 관리자 기본 계정 (ID: admin / PW: 1234)
INSERT OR IGNORE INTO admin_users (id, password, name, email, phone) 
VALUES ('admin', '1234', '최고관리자', 'admin@sangmyung.co.kr', '010-9081-3001');

-- 2. 견적 및 상담 접수 테이블 (Orders & Consultations)
-- 구분: 견적문의, 유료견적문의(50만원), 상담신청
CREATE TABLE IF NOT EXISTS project_orders (
    id VARCHAR(50) PRIMARY KEY,                  -- 접수번호 (예: SM-2025-089)
    date VARCHAR(20) NOT NULL,                   -- 접수일자 (YYYY-MM-DD)
    type VARCHAR(50) NOT NULL,                   -- 견적문의 / 유료견적문의 / 상담신청
    structure VARCHAR(100) NOT NULL,              -- RC(철근콘크리트)구조, 목구조, 경량철골구조, 철골구조
    stage VARCHAR(100) NOT NULL,                  -- 건축준비중, 토지매입완료, 건축허가취득
    name VARCHAR(100) NOT NULL,                  -- 신청자명
    phone VARCHAR(50) NOT NULL,                  -- 연락처 (HP)
    email VARCHAR(150),                          -- 이메일
    content TEXT,                                -- 문의내용
    reply TEXT,                                  -- 관리자 답변내용
    attachment VARCHAR(255),                     -- 첨부파일명 / 경로
    password VARCHAR(100),                       -- 작성자 비밀번호 (5자리 이상 영문숫자)
    payment_status VARCHAR(50) DEFAULT 'NONE',   -- NONE / 입금대기 / 입금완료
    status VARCHAR(50) DEFAULT '미답변',          -- 미답변 / 답변완료 / 상담진행중
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. NEWS 공사소식 및 보도자료 테이블 (News & Press)
CREATE TABLE IF NOT EXISTS news_articles (
    id VARCHAR(50) PRIMARY KEY,                  -- 뉴스번호 (예: NEWS-001)
    title VARCHAR(255) NOT NULL,                 -- 뉴스 제목
    category VARCHAR(100) NOT NULL,              -- 보도자료, 현장착공, 준공보도, 신기술특허
    image TEXT,                                  -- 대표 이미지 URL 또는 파일 경로
    content TEXT,                                -- 본문 내용
    date VARCHAR(20) NOT NULL,                   -- 등록일자 (YYYY-MM-DD)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Q&A 고객 질의응답 테이블 (Customer Questions & Answers)
CREATE TABLE IF NOT EXISTS qna_posts (
    id VARCHAR(50) PRIMARY KEY,                  -- Q&A 번호 (예: QNA-001)
    title VARCHAR(255) NOT NULL,                 -- 질문 제목
    author VARCHAR(100) NOT NULL,                -- 작성자명
    phone VARCHAR(50),                           -- 연락처 (답변 알림용)
    question TEXT NOT NULL,                      -- 질문 상세 내용
    answer TEXT,                                 -- 관리자 답변 내용
    password VARCHAR(100),                       -- 글 수정/조회 비밀번호
    is_secret BOOLEAN DEFAULT 0,                 -- 비밀글 여부 (1: 비밀글, 0: 공개)
    status VARCHAR(50) DEFAULT '미답변',          -- 미답변 / 답변완료
    date VARCHAR(20) NOT NULL,                   -- 등록일자 (YYYY-MM-DD)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
