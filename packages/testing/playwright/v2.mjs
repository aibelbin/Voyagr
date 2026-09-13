import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const log = (...a)=>console.log(...a);

await p.goto('http://localhost:5678/signin', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(1200);
await p.locator('input[type="email"], input[name="email"]').first().fill('owner@voyagr.local').catch(()=>{});
await p.locator('input[type="password"]').first().fill('Voyagr1234').catch(()=>{});
await p.getByRole('button', { name:/sign in/i }).click().catch(()=>{});
await p.waitForTimeout(2500);
await p.goto('http://localhost:5678/workflow/new', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(3500);

// open trigger panel
await p.mouse.click(740, 449);
await p.waitForTimeout(1500);
const trig = (await p.locator('[data-test-id="node-creator-node-item"]').allInnerTexts().catch(()=>[])).map(t=>t.replace(/\n/g,' ').trim());
log('TRIGGER items:', JSON.stringify(trig));

// add the trigger
await p.locator('[data-test-id="node-creator-node-item"]').first().click().catch(()=>{});
await p.waitForTimeout(2500);
// canvas: node name + run button text
const nodeText = (await p.locator('.vue-flow__node').first().innerText().catch(()=>'')).replace(/\n/g,' ').trim();
log('CANVAS trigger node:', JSON.stringify(nodeText));
const runBtn = (await p.getByRole('button', { name:/plan trip|execute workflow/i }).first().innerText().catch(()=>'(not found)'));
log('RUN button text:', JSON.stringify(runBtn));
await p.screenshot({ path:'/tmp/voyagr_v2_canvas.png' });

// open regular panel
await p.locator('[data-test-id="node-creator-plus-button"]').first().click().catch(()=>{});
await p.waitForTimeout(1800);
await p.screenshot({ path:'/tmp/voyagr_v2_categories.png' });

// search new nodes
for (const q of ['Activity','Ferry','Cafe','Shopping']) {
  const inp = p.locator('input[placeholder*="Search"]').first();
  await inp.fill(q).catch(()=>{});
  await p.waitForTimeout(900);
  const names = (await p.locator('[data-test-id="node-creator-node-item"]').allInnerTexts().catch(()=>[])).map(t=>t.replace(/\n/g,' ').trim());
  log(`search "${q}":`, JSON.stringify(names.slice(0,2)));
}
await b.close();
