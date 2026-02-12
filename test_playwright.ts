import { chromium } from "playwright";

async function testPlaywright() {
  console.log("[Test] Starting Playwright test...");
  
  try {
    console.log("[Test] Launching browser...");
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    
    console.log("[Test] ✅ Browser launched successfully");
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    console.log("[Test] Navigating to test page...");
    await page.goto("https://www.pref.mie.lg.jp/ebid-mie/83336046773.htm", { waitUntil: "networkidle" });
    
    console.log("[Test] ✅ Page loaded successfully");
    console.log("[Test] Page title:", await page.title());
    
    await browser.close();
    console.log("[Test] ✅ Test completed successfully");
  } catch (error) {
    console.error("[Test] ❌ Test failed:", error);
    process.exit(1);
  }
}

testPlaywright();
