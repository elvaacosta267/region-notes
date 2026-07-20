// geo/plans.geojson, geo/bupyeong_boundary.geojson (저장소 루트, 각각
// tools/build_geo.py / tools/fetch_bupyeong_boundary.py로 생성됨)를 app/public/data/ 로
// 복사한다. 빌드/개발 서버 시작 전에 실행한다.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..");
const REPO_ROOT = join(APP_ROOT, "..");
const DEST_DIR = join(APP_ROOT, "public", "data");

const FILES = [
  { src: join(REPO_ROOT, "geo", "plans.geojson"), required: true },
  { src: join(REPO_ROOT, "geo", "bupyeong_boundary.geojson"), required: false },
  { src: join(REPO_ROOT, "geo", "plan_boundaries.geojson"), required: false },
];

mkdirSync(DEST_DIR, { recursive: true });

for (const { src, required } of FILES) {
  if (!existsSync(src)) {
    if (required) {
      console.error(`[오류] ${src} 를 찾을 수 없습니다. 먼저 python3 tools/build_geo.py 를 실행하세요.`);
      process.exit(1);
    }
    console.warn(`[건너뜀] ${src} 없음 (python3 tools/fetch_bupyeong_boundary.py 로 생성 가능)`);
    continue;
  }
  const dest = join(DEST_DIR, src.split("/").pop());
  copyFileSync(src, dest);
  console.log(`[완료] ${src} -> ${dest}`);
}
