#!/usr/bin/env node
/**
 * Copy the lightningcss native binary into node_modules/lightningcss/
 * so the fallback path (../lightningcss.PLATFORM.node) works when
 * require('lightningcss-PLATFORM') fails (e.g. under Turbopack).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const lightningcssDir = path.join(root, "node_modules", "lightningcss");

function getPlatformParts() {
  const parts = [process.platform, process.arch];
  if (process.platform === "linux") {
    try {
      const { familySync, MUSL } = require("detect-libc");
      const family = familySync();
      if (family === MUSL) parts.push("musl");
      else if (process.arch === "arm") parts.push("gnueabihf");
      else parts.push("gnu");
    } catch {
      parts.push("gnu");
    }
  } else if (process.platform === "win32") {
    parts.push("msvc");
  }
  return parts;
}

const parts = getPlatformParts();
const suffix = parts.join("-");
const pkgName = `lightningcss-${suffix}`;
const fileName = `lightningcss.${suffix}.node`;
const srcDir = path.join(root, "node_modules", pkgName);
const srcFile = path.join(srcDir, fileName);
const destFile = path.join(lightningcssDir, fileName);

if (!fs.existsSync(lightningcssDir)) return;
if (!fs.existsSync(srcFile)) return;

try {
  fs.copyFileSync(srcFile, destFile);
  console.log("[postinstall] lightningcss: copied", fileName, "into lightningcss/");
} catch (err) {
  console.warn("[postinstall] lightningcss fallback copy skipped:", err.message);
}
