import { chromium } from "playwright-core";

const docs = "/Users/dougdevitre/matt-grant/docs";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + docs + "/it-request.html", { waitUntil: "load" });
await page.pdf({
  path: docs + "/IT-Request-Matt-Grant.pdf",
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log("PDF written → docs/IT-Request-Matt-Grant.pdf");
