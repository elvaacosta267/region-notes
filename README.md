# 수도권 개발계획 추적 저장소

동산공법(국토계획법·도시정비법·공공주택특별법·노후계획도시특별법·광역교통법) 기준으로
수도권 개발계획의 위계·진행단계를 장기 추적하는 저장소입니다.

## 폴더 구조
```
docs/      계획 요약·정리 문서 (md)
db/        진행현황 DB — plans.csv 가 단일 소스, schema.md 에 컬럼 정의
geo/       plans.geojson (지도용), plans.kml (Google My Maps 가져오기용)
map/       index.html — Leaflet 지도 (GitHub Pages 호스팅)
tools/     build_geo.py — csv 수정 후 geojson/kml 재생성
updates/   날짜별 변경 로그 (YYYY-MM-DD.md)
```

## 최초 세팅 (1회)
1. GitHub에서 새 저장소 생성 (예: `metro-plan-tracker`)
2. 이 폴더 전체를 업로드하거나, 로컬에서 `git init` 후 push
   ```bash
   cd project
   git init
   git add .
   git commit -m "init: 저장소 초기 세팅"
   git branch -M main
   git remote add origin https://github.com/<계정명>/<repo명>.git
   git push -u origin main
   ```
3. GitHub repo → Settings → Pages → Branch: `main`, 폴더: `/ (root)` 선택 후 저장
   - 몇 분 후 `https://<계정명>.github.io/<repo명>/` 로 접속 가능해짐
4. 지도 주소: `https://<계정명>.github.io/<repo명>/map/`
   - 폰 브라우저로 열고 "홈 화면에 추가"하면 앱처럼 사용 가능
5. (선택) Google My Maps 사용 시: mymaps.google.com → 새 지도 → 가져오기 → `geo/plans.kml` 업로드

## 업데이트 루프 (주기적)
1. Claude와 대화 시작 → `db/plans.csv` 업로드 후 "최신 진행상황 반영해줘" 요청
2. Claude가 뉴스·고시 검색 → 갱신된 `plans.csv` + `updates/YYYY-MM-DD.md` 생성
3. 받은 `plans.csv` 로 교체 후 아래 실행 (geojson/kml 재생성)
   ```bash
   python3 tools/build_geo.py
   ```
4. 커밋 & 푸시
   ```bash
   git add .
   git commit -m "update: 산본9-2 사업시행인가 (2026-08)"
   git push
   ```

> 커밋 이력 = 사업별 진행 타임라인.
> 특정 사업의 변천사는 `git log -p db/plans.csv` 또는 GitHub 웹의 History/Blame 탭에서 확인.

## 데이터 원칙
- 원문 PDF는 저장하지 않는다. **원문 링크 + 요약 md만** 쌓는다 (용량·diff 문제 방지).
- `plans.csv`의 `id`는 한 번 부여되면 불변. 단계코드는 `db/schema.md` 참조.
- 모든 상태 변경에는 반드시 출처 URL(`source_url`)을 남긴다.

## 로드맵
- [x] 1단계: 역대 국토종합계획·수도권정비계획 연혁 정리 (`docs/01`)
- [x] 2단계: 진행현황 DB 골격 + 파일럿 16건 (3기 신도시 8, GTX 3, 1기 선도지구 5)
- [ ] 3단계: 미이행 계획 추적 — 구계획 대비 신계획 대조 (도시·군기본계획 재정비 이력 등)
- [ ] 4단계: 정비구역 전수 확장 — 서울 정비몽땅, 경기·인천 고시문 (수백 건 규모)
- [ ] 5단계: 구역 경계(polygon) 반영 — 점 → 면 지도로 업그레이드
- [ ] 6단계: 진행가능성 스코어링 — 뉴스·공고 신호 기반 (Claude Code + GitHub Actions 자동화 검토)
