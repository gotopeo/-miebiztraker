import fs from "node:fs";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer";

console.log("[postinstall] Checking Chrome installation...");
console.log("[postinstall] cwd =", process.cwd());
console.log("[postinstall] uid =", process.getuid?.());
console.log("[postinstall] PUPPETEER_CACHE_DIR =", process.env.PUPPETEER_CACHE_DIR);

const p = puppeteer.executablePath();
console.log("[postinstall] executablePath =", p);
console.log("[postinstall] exists =", fs.existsSync(p));

if (fs.existsSync(p)) {
  console.log("[postinstall] ✅ Chrome already exists");
  process.exit(0);
}

console.log("[postinstall] ⚠️  Chrome not found. Installing...");

try {
  // --install-deps フラグを使用してシステムライブラリもインストール
  // ただし、root権限が必要なため、環境によっては失敗する可能性がある
  console.log("[postinstall] Installing Chrome with dependencies...");
  
  try {
    // まず --install-deps を試す（root権限が必要）
    execSync("npx @puppeteer/browsers install chrome@stable --install-deps", { stdio: "inherit" });
    console.log("[postinstall] Chrome and system dependencies installed");
  } catch (depsError) {
    console.warn("[postinstall] ⚠️  Failed to install with --install-deps (may need root). Trying without...");
    // 失敗した場合は通常のインストールを試す
    execSync("npx puppeteer browsers install chrome", { stdio: "inherit" });
    console.log("[postinstall] Chrome installed (system dependencies may need manual installation)");
  }
  
  const p2 = puppeteer.executablePath();
  console.log("[postinstall] After install executablePath =", p2);
  console.log("[postinstall] After install exists =", fs.existsSync(p2));
  
  if (!fs.existsSync(p2)) {
    console.error("[postinstall] ❌ Chrome install failed");
    process.exit(1);
  }
  
  console.log("[postinstall] ✅ Chrome installed successfully");
} catch (error) {
  console.error("[postinstall] ❌ Error during Chrome installation:", error);
  process.exit(1);
}
