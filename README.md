# 국토개발계획 기반 투자포인트 순위표

동산공법(국토계획법·도시정비법·공공주택특별법·노후계획도시특별법·광역교통법) 기준으로
국토개발계획의 위계·진행단계를 장기 추적하고, 개별 정비사업의 실현가능성을 스코어링해
순위표로 보여주는 저장소입니다.

**1차 파일럿: 인천 부평구 정비사업.** 호갱노노가 이미 잘 서비스하는 실거래가·갭투자
계산은 재구현하지 않고, 1982년부터의 국토종합계획·수도권정비계획 위계 속에서 개별
정비사업의 실현가능성을 구조화된 근거로 스코어링하는 데 집중합니다.

## 폴더 구조
```
docs/      계획 요약·정리 문서 (md) — 국토종합계획·수도권정비계획 학습본
db/        진행현황 DB — plans.csv 가 단일 소스, schema.md 에 컬럼 정의,
           stage_sequences.json 에 사업유형별 단계 시퀀스(진척률 계산용)
sources/   links_db.csv — 원문 출처 링크 트래킹(수집 대상 문서 목록, plans.csv와 별개)
geo/       plans.geojson (지도용, 실현가능성 raw factor 포함), plans.kml,
           bupyeong_boundary.geojson (부평구 실제 행정동 경계, 지도 초기 화면/배경용)
tools/     build_geo.py(csv→geojson/kml 재생성), feasibility.py(A~E 스코어링),
           test_build_geo.py(스모크 테스트)
app/       React(Vite+TS) 순위표 앱 — 실제 사용자 화면. `npm run dev`로 실행
updates/   날짜별 변경 로그 (YYYY-MM-DD.md)
```

## 순위표 앱 실행
```bash
cd app
npm install       # 최초 1회
npm run dev        # geo/plans.geojson 자동 동기화 후 개발 서버 실행
```
`npm run build`은 빌드 전 `geo/plans.geojson`을 `app/public/data/`로 동기화하고 프로덕션 빌드를 만듭니다.

## 최초 세팅 (1회)
1. GitHub에서 새 저장소 생성 (예: `metro-plan-tracker`)
2. 로컬에서 `git init` 후 push
   ```bash
   cd project
   git init
   git add .
   git commit -m "init: 저장소 초기 세팅"
   git branch -M main
   git remote add origin https://github.com/<계정명>/<repo명>.git
   git push -u origin main
   ```
3. GitHub repo → Settings → Pages → Build and deployment → Source: **"GitHub Actions"** 선택
   (`.github/workflows/deploy.yml`이 `app/` 를 빌드해 자동 배포합니다)
4. 배포 주소: `https://<계정명>.github.io/<repo명>/`
5. (선택) Google My Maps 사용 시: mymaps.google.com → 새 지도 → 가져오기 → `geo/plans.kml` 업로드

## 업데이트 루프 (주기적)
수동(대화) 또는 예약된 자동 검색, 두 경로 모두 같은 산출물을 만든다: `plans.csv` 변경분
+ `updates/YYYY-MM-DD.md` 로그(`updates/README.md` 템플릿 형식, `- [id: ...]` + `출처:`
필수). `build_geo.py`가 이 로그를 파싱해 각 사업의 "최근 업데이트" 배지(순위표 앱에 표시,
🆕 아이콘, 클릭 시 출처로 이동)를 채운다.

**수동:**
1. Claude와 대화 시작 → `db/plans.csv` 업로드 후 "최신 진행상황 반영해줘" 요청
2. Claude가 뉴스·고시 검색 → 갱신된 `plans.csv` + `updates/YYYY-MM-DD.md` 생성
3. 받은 `plans.csv` 로 교체 후 아래 실행 (geojson/kml 재생성 + 스모크 테스트)
   ```bash
   python3 tools/build_geo.py
   python3 tools/test_build_geo.py
   ```
4. 커밋 & 푸시
   ```bash
   git add .
   git commit -m "update: 산본9-2 사업시행인가 (2026-08)"
   git push
   ```

**자동(예약 작업):** 부동산 뉴스·구청/시청 고시를 주기적으로 검색해 위와 같은 변경분을
찾으면 **PR을 초안으로 열고 자동 병합하지 않는다** — 사업명 오매칭·오래된 기사 재인용 같은
오탐지 위험이 있어 사람이 리뷰 후 머지해야 한다. 예약 작업 설정/변경은 `schedule` 스킬로
관리한다.

> 커밋 이력 = 사업별 진행 타임라인.
> 특정 사업의 변천사는 `git log -p db/plans.csv` 또는 GitHub 웹의 History/Blame 탭에서 확인.

## 데이터 원칙
- 원문 PDF는 이 저장소(git)에 올리지 않는다. GitHub는 파일 하나가 100MB 넘으면 업로드가
  막히고 저장소 전체도 1GB 안팎을 권장 상한으로 본다. **원문 링크(`sources/links_db.csv`)
  + 요약 md(`docs/plans/*.md`)만** 쌓고, 원본은 사용자 로컬/개인 클라우드에 별도 보관한다.
- `plans.csv`의 `id`는 한 번 부여되면 불변. 단계코드는 `db/schema.md`·`db/stage_sequences.json` 참조.
- 모든 상태 변경에는 반드시 출처 URL(`출처URL`)을 남긴다.
- 실현가능성 점수(A~E)는 원자료(raw factor)만 `geo/plans.geojson`에 저장하고, 가중치를
  곱한 최종 점수는 `app/`(프론트엔드)에서 그때그때 계산한다 — 가중치가 바뀌어도 데이터를
  다시 만들 필요가 없다.
- `대략가격대`는 수작업 추정치이며 실제 시세가 아니다. 투자 판단 전 반드시 호갱노노 등에서
  재확인해야 한다.
- `updates/*.md`에 없는 변경은 순위표 앱에 "최근 업데이트" 배지로 표시되지 않는다 — 배지는
  이 로그 파일을 파싱해서 채워지므로, `plans.csv`만 고치고 로그를 안 남기면 배지가 안 뜬다.

## 로드맵
- [x] 1단계: 역대 국토종합계획·수도권정비계획 연혁 정리 (`docs/01`)
- [x] 2단계: 진행현황 DB 골격 + 수도권 파일럿 16건 (3기 신도시 8, GTX 3, 1기 선도지구 5)
- [x] 3단계: 인천 부평구 정비사업 33건 편입 + 실현가능성 스코어링(A~E) + React 순위표 앱
- [ ] 4단계: 세후 수익률 계산기(개인/법인 명의 구분, 취득세·양도세·재산세 통합) — 범용 추정
      도구로 설계, 세무 자문 아님을 명시. 최신 세율 조사 선행 필요
- [ ] 5단계: 부평구 외 지역(다른 구, 대전·부산·세종) 확장
- [ ] 6단계: 정비구역 전수 확장, 구역 경계(polygon) 반영 — 점 → 면 지도로 업그레이드
