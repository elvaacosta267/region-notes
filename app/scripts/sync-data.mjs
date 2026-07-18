// geo/plans.geojson (저장소 루트, db/plans.csv에서 tools/build_geo.py로 생성됨)를
// app/public/data/ 로 복사한다. 빌드/개발 서버 시작 전에 실행한다.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..");
const REPO_ROOT = join(APP_ROOT, "..");

const SRC = join(REPO_ROOT, "geo", "plans.geojson");
const DEST_DIR = join(APP_ROOT, "public", "data");
const DEST = join(DEST_DIR, "plans.geojson");

if (!existsSync(SRC)) {
  console.error(`[오류] ${SRC} 를 찾을 수 없습니다. 먼저 python3 tools/build_geo.py 를 실행하세요.`);
  process.exit(1);
}

mkdirSync(DEST_DIR, { recursive: true });
copyFileSync(SRC, DEST);
console.log(`[완료] ${SRC} -> ${DEST}`);
