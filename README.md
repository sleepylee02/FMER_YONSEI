# 연세대학교 빈 강의실 찾기 (FMER Yonsei)

연세대학교 학생들을 위한 빈 강의실 검색 웹 애플리케이션입니다. 원하는 시간대와 건물을 선택하면 사용 가능한 강의실을 확인할 수 있습니다.

## 🌟 주요 기능

- **빈 강의실 검색**: 날짜, 시간, 건물을 선택하여 사용 가능한 강의실 확인
- **실시간 현황**: 현재 사용 중인 강의실과 수업 정보 표시
- **주간 일정 보기**: 강의실 클릭 시 해당 강의실의 주간 일정 확인
- **모바일 지원**: 반응형 디자인으로 모바일 기기에서도 편리하게 사용

## 🚀 데모

[GitHub Pages에서 확인하기](https://sleepylee02.github.io/FMER_YONSEI/frontend/)

## 📱 사용 방법

1. 원하는 **날짜**와 **시간대**를 선택합니다
2. 찾고자 하는 **건물**을 드롭다운에서 선택합니다
3. "빈 강의실 찾기" 버튼을 클릭합니다
4. 결과에서 강의실을 클릭하면 주간 일정을 확인할 수 있습니다

## 🏗️ 프로젝트 구조

```
FMER_YONSEI/
├── frontend/           # 웹 프론트엔드
│   ├── index.html     # 메인 페이지
│   ├── script.js      # JavaScript 로직
│   └── style.css      # 스타일시트
├── crawling/          # 데이터 크롤링 스크립트
│   ├── main.py        # 연세대 포털 크롤러
│   ├── .env.example   # 환경변수 예시 파일
│   └── requirements.txt
├── data/              # 크롤링된 데이터
│   ├── building.json  # 건물별 강의실 정보
│   └── *.jsonl       # 주간 스케줄 데이터
└── README.md
```

## 🛠️ 개발 환경 설정

### 프론트엔드 (GitHub Pages)

프론트엔드는 정적 웹사이트로 별도 설치가 필요하지 않습니다.

### 데이터 크롤링 (선택사항)

새로운 데이터를 크롤링하려면 다음 단계를 따르세요:

1. **Python 환경 설정**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **환경변수 설정**:
   ```bash
   cp crawling/.env.example crawling/.env
   # .env 파일을 편집하여 연세대 포털 계정 정보 입력
   ```

3. **크롤링 실행**:
   ```bash
   cd crawling
   python main.py
   ```

## 📊 데이터 소스

- **강의실 정보**: 연세대학교 공간예약시스템 (space.yonsei.ac.kr)
- **수업 스케줄**: 연세대학교 포털 시스템
- **업데이트 주기**: 수동 (주 단위)

## 🔧 기술 스택

### 프론트엔드
- **HTML5/CSS3**: 반응형 웹 디자인
- **Vanilla JavaScript**: 프레임워크 없는 순수 JS
- **GitHub Pages**: 무료 호스팅

### 백엔드/크롤링
- **Python 3.12+**: 메인 언어
- **requests**: HTTP 클라이언트
- **BeautifulSoup**: HTML 파싱
- **python-dotenv**: 환경변수 관리

## 📝 주의사항

- 이 프로젝트는 **교육 목적**으로 개발되었습니다
- 연세대학교 공식 서비스가 아닙니다
- 크롤링 시 서버에 과부하를 주지 않도록 적절한 딜레이를 포함했습니다
- 개인 계정 정보는 절대 공유하지 마세요

## 🤝 기여하기

1. 이 저장소를 포크합니다
2. 새로운 기능 브랜치를 만듭니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 문의

프로젝트에 대한 질문이나 제안사항이 있으시면 GitHub Issues를 통해 연락해 주세요.

---

**연세대학교 학생들의 편의를 위해 만들어진 프로젝트입니다** 📚✨
