# 상명건설 웹 애플리케이션 개발 서버 호스팅 추천 및 배포 가이드

개발 서버로서 **여러 프로젝트를 동시에 업로드하고 관리하기 쉬우며 비용이 저렴한 호스팅 3가지**를 엄선하여 추천 및 신청 절차를 안내해 드립니다.

---

## 🏆 1순위 추천: 클라우드타입 (Cloudtype) - 가장 쉽고 빠른 국내 PaaS
> **추천 이유:** 서버 명령어(리눅스) 지식 없이도 GitHub 연동 또는 폴더 업로드만으로 1분 만에 배포 가능. 국내 서비스로 속도가 빠르고 무료 티어 및 월 3,000~10,000원의 초저가 플랜 제공.

### 💡 장점:
1. **간편한 멀티 프로젝트 관리**: 프로젝트별로 컨테이너를 몇 번의 클릭으로 무제한 생성/관리 가능.
2. **무료 SSL(HTTPS) 및 도메인 기본 제공**: `*.cloudtype.app` 주소를 즉시 제공하여 별도 도메인 구매 없이 테스트 가능.
3. **Node.js, Express, SQLite 완벽 지원**.

### 🚀 신청 및 배포 단계:
1. **가입**: [cloudtype.io](https://cloudtype.io) 접속 후 GitHub 또는 구글 계정으로 1초 가입.
2. **프로젝트 생성**: 우측 상단 `[+ 프로젝트 생성]` 클릭 후 프로젝트 이름(예: `sang-myung-construct`) 입력.
3. **애플리케이션 배포**:
   - `[새 서비스]` -> `[Node.js]` 선택.
   - GitHub 저장소(`ganahome/design`)를 연결하거나 zip 파일 업로드.
   - 빌드 명령어: `npm run build`
   - 시작 명령어: `node server.js`
   - 포트 번호: `3000` 입력 후 `[배포하기]` 클릭.
4. **완료**: 1분 후 제공되는 URL로 즉시 접속 가능!

---

## 🥈 2순위 추천: 카페24 가상서버(VPS) 호스팅 - 가성비 최강 & 안정적인 고정 IP
> **추천 이유:** 월 5,500원 수준(절약형 기준)으로 독립 리눅스 가상 서버(Ubuntu) 1대를 통째로 임대. 한 서버 안에 본 프로젝트를 포함해 5~10개 이상의 다른 사이트를 포트별(3000, 4000, 8000...) 또는 가상 호스트(Nginx)로 함께 올려두고 개발 서버로 쓰기에 최적.

### 💡 장점:
1. **다중 프로젝트 무제한 구축**: Nginx 리버스 프록시를 통해 여러 서브도메인이나 포트로 수십 개의 프로젝트 운용 가능.
2. **국내 1위 인프라**: 빠른 응답속도와 한국어 고객센터 지원.

### 🚀 신청 및 세팅 단계:
1. **신청**: [cafe24.com](https://www.cafe24.com) -> `서버호스팅` -> `가상서버(VPS)` 선택.
2. **OS 선택**: `Ubuntu 22.04 LTS` 선택 후 결제 (월 5,500원~15,000원).
3. **서버 접속**:
   ```bash
   ssh root@서버IP주소
   ```
4. **환경 설치 (Node.js & Nginx)**:
   ```bash
   # Node.js 20 설치
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs unzip git

   # 프로젝트 폴더 생성 및 소스 업로드
   mkdir -p /var/www/sangmyung
   cd /var/www/sangmyung
   # 다운로드한 sang_myung_construct_project.zip 업로드 후 압축 해제
   unzip sang_myung_construct_project.zip

   # 패키지 설치 및 PM2 백그라운드 무중단 실행
   npm install
   npm install -g pm2
   pm2 start server.js --name "sangmyung"
   pm2 save
   pm2 startup
   ```

---

## 🥉 3순위 추천: 오라클 클라우드 프리티어 (Oracle Cloud Always Free) - 평생 무료
> **추천 이유:** ARM 기반 최대 4Core 24GB RAM 인스턴스를 **평생 무료(0원)**로 제공. 개발 및 테스트 서버로 여러 프로젝트를 동시에 돌리기에 가장 넉넉한 스펙.

### 💡 장점:
- 비용이 전혀 들지 않음 (신용카드 인증만 필요, 0원 결제).
- 여러 도커(Docker) 컨테이너를 띄워 다양한 프로젝트를 격리 관리하기 용이.

---

## 📦 현재 프로젝트 즉시 로컬 실행 방법 (Zip 다운로드 후)
1. 다운로드한 `sang_myung_construct_project.zip`의 압축을 풉니다.
2. 터미널(또는 명령 프롬프트)을 열고 해당 폴더로 이동합니다:
   ```bash
   cd sang_myung_construct_project
   ```
3. 의존성 설치:
   ```bash
   npm install
   ```
4. 서버 실행:
   ```bash
   node server.js
   ```
5. 브라우저에서 접속:
   - 공식 웹사이트: `http://localhost:3000`
   - 관리자 콘솔: `http://localhost:3000/admin` (아이디: `admin` / 비밀번호: `1234`)
