#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const distFile = path.resolve("dist/main.js");
const outFile = path.resolve("main.js");

function copyOnce() {
  try {
    if (fs.existsSync(distFile)) {
      fs.cpSync(distFile, outFile, { force: true });
      console.log(`[copy-dist-main] Copied ${distFile} -> ${outFile}`);
    } else {
      console.log(`[copy-dist-main] Waiting for ${distFile} to exist...`);
    }
  } catch (e) {
    console.error("[copy-dist-main] Copy failed:", e);
  }
}

copyOnce();

try {
  fs.watch(
    path.dirname(distFile),
    { persistent: true },
    (eventType, filename) => {
      if (filename && filename.toString() === "main.js") {
        copyOnce();
      }
    }
  );
  console.log("[copy-dist-main] Watching dist/ for main.js changes...");
} catch (e) {
  console.warn("[copy-dist-main] fs.watch not available, will only copy once.");
}
