# Quiz Master - 상식 퀴즈 게임

## 프로젝트 개요
한국어 상식 퀴즈 웹앱. 4개 카테고리(한국사, 과학, 지리, 예술과 문화) × 10문제 = 40문제.
기존 문제(로컬 JSON) 모드와 AI 문제(Gemini API) 모드 지원.

## 기술 스택
- **프론트엔드**: HTML5 + CSS3 + Vanilla JS (ES6+), 프레임워크/번들러 없음
- **백엔드**: Vercel 서버리스 함수 (API 프록시)
- **DB**: Supabase (공유 랭킹), localStorage (폴백)
- **AI**: Google Gemini 2.5 Flash API
- **폰트**: Noto Sans KR (Google Fonts)

## 프로젝트 구조
```
index.html          # 메인 HTML (시작/퀴즈/결과 화면, 모달 4개)
style.css           # 스타일시트 (반응형, 애니메이션, 글래스모피즘)
script.js           # 전체 게임 로직 (~2000줄, 단일 파일)
apikey.js           # 로컬 개발용 API 키 (.gitignore 대상)
api/gemini.js       # Vercel 서버리스 프록시 (Gemini API 키 보호)
data/questions.json # 문제 데이터 (HTTP fetch용)
data/questions.js   # 문제 데이터 (file:// 프로토콜 fallback)
.env                # 환경변수 (.gitignore 대상)
```

## 아키텍처 & 코드 컨벤션

### script.js 구조 (섹션 순서)
1. `CONFIG` - 설정 상수 (Object.freeze)
2. Supabase Client 초기화
3. Security Utilities (`escapeHtml`, `validateName`)
4. `Storage` - localStorage 래퍼
5. Ranking Data Validation
6. `gameState` - 게임 상태 객체
7. `dom` - 캐시된 DOM 요소 (`initDomCache()`로 초기화)
8. Timeout Management (`managedTimeout`, `clearAllTimeouts`)
9. Data Loading (`loadQuestions` - fetch + script 태그 fallback)
10. Initialization (`DOMContentLoaded` → `initDomCache` → `setupEventListeners` → `loadQuestions`)
11. Event Listeners
12. Quiz Logic (시작, 문제 표시, 답변 처리, 다음 문제)
13. Gemini AI (프롬프트 빌드, API 호출, 쿨다운/재시도)
14. Results (결과 표시, 등급 계산, SVG 링 애니메이션)
15. Ranking System (Supabase + localStorage fallback)
16. UX Enhancements (스크린리더, 모달, 키보드 네비게이션)

### 코딩 스타일
- Vanilla JS, 모듈 시스템 없음 (전역 함수/변수)
- `var` 와 `const`/`let` 혼용 (레거시 호환성)
- DOM 조작: `textContent` 사용 (XSS 방지), `innerHTML`은 정적 마크업에만
- 이벤트 리스너: `addEventListener` 사용
- 비동기: Promise 기반 (`async/await` 일부 사용)
- HTML 이스케이프: `escapeHtml()` 유틸리티 사용

### 보안 원칙
- 사용자 입력은 반드시 `validateName()` 으로 검증
- 동적 콘텐츠는 `textContent`로 삽입 (innerHTML 지양)
- API 키는 `apikey.js` (로컬) 또는 Vercel 환경변수 (프로덕션)에서 관리
- Supabase Anon Key는 클라이언트 노출 허용 (RLS 정책으로 보안)

## 배포
- **플랫폼**: Vercel
- **프로덕션**: AI 모드는 `/api/gemini` 서버리스 프록시 경유
- **로컬 개발**: `apikey.js`에서 `window.LOCAL_CONFIG`로 키 주입, Live Server 또는 `python -m http.server` 사용
- **file:// 프로토콜**: fetch 실패 시 `data/questions.js` 스크립트 태그 fallback 자동 작동

## 주요 설정값 (CONFIG)
- 정답당 10점, 최대 랭킹 10개
- 등급: S(90%+) / A(80%+) / B(70%+) / C(60%+) / D(50%+) / F
- AI 문제: 10개, 쿨다운 60초, 최대 재시도 2회
- 데이터 로딩: 타임아웃 10초, 최대 재시도 3회

## 수정 시 주의사항
- `data/questions.json`과 `data/questions.js`는 동일한 데이터를 유지해야 함
- `dom` 객체의 요소 참조는 `initDomCache()`에서만 초기화
- `managedTimeout()`을 사용해야 게임 리셋 시 타임아웃이 정리됨
- 랭킹 저장: Supabase 우선 → 실패 시 localStorage fallback
- 모달은 `showModal()`/`hideModal()`로 관리 (포커스 트랩 포함)

## 퀴즈 문제 교차 검증 가이드라인
모든 문제 작성 시 확인 사항
1. 정답이 하나뿐인가?
- 다른 해석 가능 시 조건 명시 (예: 면적 기준, 2024년 기준)
2. 최상급 표현에 기준이 있는가?
- ‘가장 큰’, ‘최초의’ 등 표현에 측정 기준 명시
3. 시간과 범위가 명확한가?
- 변할 수 있는 정보는 시점 명시
- 지리적, 분류적 범위 한정
4. 교차 검증했는가?
- 의심스러운 정보는 2개 이상 출처 확인
- 논란 있는 내용은 주류 학설 기준

