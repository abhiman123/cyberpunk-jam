const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('http://localhost:5174/');
    await new Promise(r => setTimeout(r, 2000));
    // Click the "BEGIN SHIFT" button
    await page.mouse.click(640, 500);
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
})();
