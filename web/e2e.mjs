// Headless Chrome smoke test. Needs a server on :8765 and a project named "Paper" (any scaffolded project).
import puppeteer from "puppeteer-core";
const OUT = process.env.OUT || ".";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && console.log("console:", m.text()));

await page.goto("http://localhost:8765/", { waitUntil: "networkidle0" });
await page.waitForSelector(".card");
console.log("landing cards:", await page.$$eval(".card .title", (a) => a.map((e) => e.textContent)));
await page.screenshot({ path: `${OUT}/home.png` });

await page.evaluate(() => [...document.querySelectorAll(".card")].find((c) => c.textContent.includes("Paper")).click());
await page.waitForSelector("#preview img", { timeout: 10000 });
console.log("editor opened:", await page.$eval("#proj-name", (e) => e.textContent), "status:", await page.$eval("#status", (e) => e.textContent));
await page.screenshot({ path: `${OUT}/editor.png` });

await page.click("#toggle-preview");
console.log("preview hidden:", await page.$eval("#app", (e) => e.classList.contains("no-preview")), "btn:", await page.$eval("#toggle-preview", (e) => e.textContent));
await page.click("#toggle-preview");
console.log("preview shown:", !(await page.$eval("#app", (e) => e.classList.contains("no-preview"))));

await page.click(".cm-content"); await page.keyboard.press("End");
await page.keyboard.type("\n#nope\n");
await new Promise((r) => setTimeout(r, 1200));
console.log("error shown:", await page.$eval("#errors", (e) => e.hidden ? "hidden" : e.textContent));
for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace");
await new Promise((r) => setTimeout(r, 1200));
console.log("recovered status:", await page.$eval("#status", (e) => e.textContent));

await page.click("#sidebar .theme-toggle");
console.log("theme:", await page.evaluate(() => document.documentElement.dataset.theme));
await page.screenshot({ path: `${OUT}/editor-dark.png` });
await page.click("#sidebar .theme-toggle");

await page.click("#sidebar .back");
await page.waitForSelector("#home:not([hidden])");
console.log("back home:", !(await page.$eval("#app", (e) => e.hidden)) === false);
await browser.close();
