// The supported walkthrough export entry point: validate, probe, then render.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { preflight, projectRoot, readProps } from "./preflight.mjs";

const require = createRequire(import.meta.url);
const [composition, output, ...flags] = process.argv.slice(2);
let work;
try {
  if (!["Walkthrough-9x16", "Walkthrough-16x9"].includes(composition) || !output || output.startsWith("-")) {
    throw new Error("Aufruf: npm run render:walkthrough -- Walkthrough-9x16 out/video.mp4 --props=walkthrough/datei.json");
  }
  const propsFlags = flags.filter((f) => f.startsWith("--props="));
  if (propsFlags.length !== 1) throw new Error("Genau eine --props=<Datei> angeben");
  const extra = flags.filter((f) => !f.startsWith("--props="));
  if (extra.some((f) => !/^--(concurrency|frames|scale|log)=\S+$/.test(f))) {
    throw new Error("Erlaubte Zusatzoptionen: --concurrency=, --frames=, --scale=, --log=");
  }
  const target = path.resolve(output);
  const publicRelative = path.relative(path.join(projectRoot, "public"), target);
  if ((!publicRelative.startsWith("..") && !path.isAbsolute(publicRelative)) || existsSync(target)) {
    throw new Error("Ausgabe muss neu sein und außerhalb von public/ liegen");
  }
  const props = readProps(path.resolve(propsFlags[0].slice(8)), composition === "Walkthrough-9x16" ? "vertical" : "horizontal");
  console.log("Medienprüfung:", JSON.stringify(preflight(props)));
  work = mkdtempSync(path.join(tmpdir(), "walkthrough-render-"));
  const snapshot = path.join(work, "props.json");
  writeFileSync(snapshot, JSON.stringify(props));
  const cli = path.join(path.dirname(require.resolve("@remotion/cli/package.json")), "remotion-cli.js");
  const result = spawnSync(process.execPath, [cli, "render", composition, target, `--props=${snapshot}`,
    "--codec=h264", "--pixel-format=yuv420p", "--overwrite=false", ...extra], {
    cwd: projectRoot, stdio: "inherit", env: process.env,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`Walkthrough-Export abgebrochen: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (work) rmSync(work, { recursive: true, force: true });
}
