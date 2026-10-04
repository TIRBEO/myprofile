/* Captures the documentation figures.

   The manifest lives in the rendered articles themselves: every step that
   claims a picture carries data-route / data-target / data-out, so this walks
   the articles, then photographs the exact element on each route with a
   numbered ring and arrow drawn over it in the site's own accent.

   Run it against localhost, not 127.0.0.1 — the dev server's HMR socket only
   answers on the former, and a page whose socket fails never hydrates.

   node scripts/capture-doc-figures.cjs            capture everything
   node scripts/capture-doc-figures.cjs --list     report what resolves, write nothing
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.MP_BASE || "http://localhost:3005";
const OUT = path.join(__dirname, "..", "public", "docs");
const W = 420; // the column the reader actually uses
const H = 900;
const DSF = 3;
const GUTTER = 50; // room above the target for the badge and its arrow
const BELOW = 20;
/** How much of the column a picture of "the page itself" holds: the title and
    the first few rows, which is what tells you that you're on the right page. */
const TOP_SHOT = 430;
const PUBLIC_ORIGIN = "https://tirbeo.com";

/* A figure can name a state its page has to be in first, because two steps
   can need opposite ones — the button that files an appeal and the page that
   appears once it's filed. Each state gets its own fresh load. */
const PREPS = {
  appeal: async (page) => {
    const ask = page.locator('main button:has-text("Request a review")');
    if (!(await ask.count())) return;
    await ask.first().click();
    await page.waitForTimeout(500);
    const box = page.locator("textarea").first();
    if (await box.count()) {
      await box.fill(
        "This was me — I was in Lagos on business and the card I used is the one on the account. The two attempts ten minutes apart were me retrying after a bad connection, not somebody else.",
      );
    }
    const send = page.locator('button:has-text("Send request")');
    if (await send.count()) await send.first().click();
    await page.waitForTimeout(900);
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, theme) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: DSF,
    hasTouch: true,
    colorScheme: theme,
    locale: "en-US",
  });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("tirbeo:theme", t);
      /* A fresh profile is gated by the account's unread decisions, and every
         page behind that gate is the same screen. The pictures are of the
         settings, so the decisions are marked as read before anything loads. */
      localStorage.setItem(
        "tirbeo:account-status:skipped",
        JSON.stringify(["blocked-lagos", "changes-on-hold", "confirm-pokhara"]),
      );
    } catch (e) {}
  }, theme);
  /* The dev server stamps its own "N" badge into the bottom-left corner of
     every page. It is not part of the product, so it has no business being in
     a picture of the product. */
  await context.addInitScript(() => {
    const kill = () => {
      for (const el of document.getElementsByTagName("nextjs-portal")) {
        el.style.setProperty("display", "none", "important");
      }
    };
    const start = () => {
      kill();
      new MutationObserver(kill).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    };
    if (document.documentElement) start();
    else document.addEventListener("readystatechange", start, { once: true });
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("  ! pageerror", String(err).slice(0, 160)));
  return { context, page };
}

/* Every article, in the order the index lists them. */
async function articleSlugs(page) {
  await page.goto(BASE + "/settings/help", { waitUntil: "load" });
  await page.waitForSelector("main a[href^='/settings/help/']");
  return page.$$eval("main a[href^='/settings/help/']", (as) => [
    ...new Set(
      as
        .map((a) => (a.getAttribute("href") || "").replace("/settings/help/", ""))
        .filter((s) => s && s !== "support" && !s.startsWith("policy/")),
    ),
  ]);
}

/* The steps that claim a picture, straight off the rendered page. */
async function readFigures(page, slug) {
  await page.goto(`${BASE}/settings/help/${slug}`, { waitUntil: "load" });
  await page.waitForSelector("main");
  await page.waitForTimeout(700);
  return page.$$eval("[data-doc-figure]", (figs) =>
    figs.map((f) => ({
      out: f.getAttribute("data-out"),
      route: f.getAttribute("data-route"),
      target: f.getAttribute("data-target"),
      index: Number(f.getAttribute("data-index") || 0),
      side: f.getAttribute("data-side") || "right",
      narr: f.getAttribute("data-narr") || "",
      prep: f.getAttribute("data-prep") || "",
    })),
  );
}

/* Geometry in viewport coordinates, because that is what stays true after a
   scroll. The palette comes from the page so the callout is the site's blue. */
async function measure(page, loc) {
  const box = await loc.boundingBox();
  if (!box) return null;
  return page.evaluate(
    (b) => {
      const main = document.querySelector("main") || document.body;
      const m = main.getBoundingClientRect();
      const acc = getComputedStyle(document.documentElement);
      return {
        x: b.x,
        y: b.y,
        w: b.width,
        h: b.height,
        mx: m.left,
        mw: m.width,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewH: window.innerHeight,
        accent: acc.getPropertyValue("--accent").trim(),
        fg: acc.getPropertyValue("--accent-fg").trim(),
      };
    },
    { x: box.x, y: box.y, width: box.width, height: box.height },
  );
}

/* Measure, then make sure there's room under the target: scrollIntoView is
   happy with one visible pixel, and a crop that ends at the target's own
   bottom edge says nothing about where it sits. */
async function frameFor(page, loc) {
  let m = await measure(page, loc);
  if (!m || !m.w || !m.h) return null;
  const need = (m.h < 64 ? 128 : BELOW) + 10;
  /* Never scroll so far that the target's own top edge leaves the screen — a
     list taller than the viewport is cropped from its first row. */
  const want = Math.round(m.y + m.h + need - m.viewH);
  const delta = Math.max(0, Math.min(want, Math.round(m.y)));
  if (delta > 4) {
    await page.evaluate((d) => window.scrollBy(0, d), delta);
    await sleep(200);
    m = await measure(page, loc);
  }
  return m;
}

/* A figure is a slice of the column rather than a tight box: the rows beside
   the highlighted one are what tell the reader where they are. screenshot()
   takes its clip in VIEWPORT coordinates, so everything here stays in them. */
function clipOf(m) {
  const below = m.h < 64 ? 128 : BELOW; // a heading on its own is not a picture
  const y = Math.max(0, Math.round(m.y - GUTTER));
  const bottom = Math.min(Math.round(m.viewH), Math.round(m.y + m.h + below));
  return {
    x: Math.max(0, Math.round(m.mx)),
    y,
    width: Math.max(120, Math.round(m.mw)),
    height: Math.max(90, bottom - y),
  };
}

/* Coords are local to the clip, which is also where the holder sits. */
function overlaySvg(m, clip, entry, n) {
  const x = m.x - clip.x;
  const y = m.y - clip.y;
  const cx = entry.side === "left" ? x + 26 : x + m.w - 26;
  const r = 13.5;
  const cy = Math.max(y - 28, r + 5);
  const stem = y - cy - 6 > r; // no arrow when the badge has to overlap
  const ring = 5;
  const box = `<rect x="${x - ring}" y="${y - ring}" width="${m.w + ring * 2}" height="${m.h + ring * 2}" rx="${12 + ring}"`;
  const cxv = Math.min(Math.max(cx, r + 2), clip.width - r - 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${clip.width}" height="${clip.height}" viewBox="0 0 ${clip.width} ${clip.height}">
  ${box} fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="8"/>
  ${box} fill="none" stroke="${m.accent}" stroke-width="3"/>
  ${
    stem
      ? `<line x1="${cxv}" y1="${cy + r}" x2="${cxv}" y2="${y - 3}" stroke="${m.accent}" stroke-width="3" stroke-linecap="round"/>
  <path d="M ${cxv - 5.5} ${y - 9} L ${cxv + 5.5} ${y - 9} L ${cxv} ${y - 1} Z" fill="${m.accent}"/>`
      : ""
  }
  <circle cx="${cxv}" cy="${cy}" r="${r}" fill="${m.accent}" stroke="#fff" stroke-opacity="0.92" stroke-width="1.5"/>
  <text x="${cxv}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="15" font-weight="700" fill="${m.fg || "#ffffff"}">${n}</text>
</svg>`;
}

async function stamp(page, clip, svg) {
  await page.evaluate(
    ([c, markup]) => {
      const old = document.getElementById("doc-shot-overlay");
      if (old) old.remove();
      const holder = document.createElement("div");
      holder.id = "doc-shot-overlay";
      holder.setAttribute(
        "style",
        `position:fixed;left:${c.x}px;top:${c.y}px;width:${c.width}px;height:${c.height}px;overflow:hidden;pointer-events:none;z-index:2147483000;`,
      );
      holder.innerHTML = markup;
      document.body.appendChild(holder);
    },
    [clip, svg],
  );
}

(async () => {
  const listOnly = process.argv.includes("--list");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const { context: idxCtx, page: idxPage } = await newPage(browser, "light");
  const slugs = await articleSlugs(idxPage);
  await idxCtx.close();
  console.log("articles:", slugs.join(" "));

  const manifest = [];
  for (const slug of slugs) {
    const { context, page } = await newPage(browser, "light");
    const figs = await readFigures(page, slug);
    await context.close();
    manifest.push(...figs);
    console.log(`${slug}: ${figs.length} figures`);
  }
  console.log("total figures:", manifest.length);
  if (listOnly) {
    for (const m of manifest) console.log(` ${m.out}  <-  ${m.route}  ${m.target}`);
    await browser.close();
    return;
  }

  const routes = [...new Set(manifest.map((m) => m.route))];
  const misses = [];
  let done = 0;

  for (const theme of ["light", "dark"]) {
    const { context, page } = await newPage(browser, theme);
    for (const route of routes) {
      const all = manifest.filter((m) => m.route === route);
      for (const prep of [...new Set(all.map((e) => e.prep))]) {
        const entries = all.filter((e) => e.prep === prep);
        const res = await page.goto(BASE + route, { waitUntil: "load" });
        /* A step can name a page this build doesn't have yet. Photographing
           the 404 would put a picture of nothing in front of the reader. */
        if (!res || !res.ok()) {
          misses.push(`${theme} ${route} NOT SERVED (${res ? res.status() : "no response"})`);
          continue;
        }
        await page.waitForSelector("main", { timeout: 4000 }).catch(() => null);
        /* Not every page is built from the settings shell — the sign-in screen
           is its own thing — so a page without a column is photographed from
           the body rather than skipped. */
        const anchor = (await page.locator("main").count()) ? "main" : "body";
        await sleep(800);
        if (prep && PREPS[prep]) await PREPS[prep](page);
        else if (prep.startsWith("sheet:")) {
          /* Most steps after the first one happen inside something the previous
             step opened. Pressing that row here means the picture shows the
             sheet rather than the page behind it. */
          const label = prep.slice(6);
          /* Buttons only — a row that happens to be a link would navigate away
             and photograph the wrong page entirely. */
          const row = page.locator(`main button:has-text("${label}")`);
          if (await row.count()) {
            await row.first().click();
            await sleep(600);
          } else {
            console.log(`prep miss: nothing labelled "${label}" on ${route}`);
          }
        }
        for (const entry of entries) {
          const n = Number(entry.out.replace(/.*-(\d+)-light\.png$/, "$1"));
          const name = path.basename(
            theme === "dark" ? entry.out.replace(/-light\.png$/, "-dark.png") : entry.out,
          );
          const file = path.join(OUT, name);
          /* A step that names a label gets the callout drawn on that label. A
             step with no label, or one whose label isn't on the page after all,
             gets the top of the page instead — the reader still sees where they
             are going, which is the whole point of the picture. */
          const loc = entry.target ? page.locator(entry.target).first() : null;
          const found = loc
            ? !!(await loc.count().catch(() => 0)) &&
              !!(await loc.isVisible().catch(() => false))
            : false;
          if (entry.target && !found) {
            misses.push(`${theme} ${name} no match -> open sheet or page top  ${route}  ::  ${entry.target}`);
          }
          /* A prep can leave a toast on screen, and a picture of a setting
             with a notification pasted over it teaches nobody anything. */
          await page.evaluate(() => {
            for (const el of document.querySelectorAll('[role="status"]')) el.remove();
          });
          /* Anything the page builds from window.location.origin reads
             "localhost:3005" on the dev server. Swap in the address a reader
             would actually be shown before photographing it. */
          await page.evaluate(
            ([from, to]) => {
              const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              let n;
              while ((n = walk.nextNode())) {
                if (n.nodeValue && n.nodeValue.includes(from)) {
                  n.nodeValue = n.nodeValue.split(from).join(to);
                }
              }
            },
            [BASE, PUBLIC_ORIGIN],
          );
          await sleep(200);

          let clip;
          let svg = "";
          if (found) {
            await loc.scrollIntoViewIfNeeded().catch(() => {});
            await sleep(200);
            const m = await frameFor(page, loc).catch(() => null);
            if (!m || m.y < -2 || m.y > m.viewH) {
              misses.push(`${theme} ${name} OFF SCREEN  ${route}  ::  ${entry.target}`);
              continue;
            }
            clip = clipOf(m);
            svg = overlaySvg(m, clip, entry, n);
          } else {
            /* A step often describes something that only exists once you've
               failed a rule — the error under the box, the sheet that asks you
               to confirm. The page can't be put into that state, but if a
               sheet is open the sheet itself is still the right picture, so
               the page top is the last resort rather than the first. */
            const sheet = page.locator('[role="dialog"]').first();
            const open =
              (await sheet.count().catch(() => 0)) &&
              (await sheet.isVisible().catch(() => false));
            const box = open ? await sheet.boundingBox().catch(() => null) : null;
            if (box && box.width > 40 && box.height > 40) {
              clip = {
                x: Math.max(0, Math.round(box.x)),
                y: Math.max(0, Math.round(box.y)),
                width: Math.max(120, Math.round(box.width)),
                height: Math.max(90, Math.min(Math.round(box.height), H - Math.round(box.y))),
              };
            } else {
              await page.evaluate(() => window.scrollTo(0, 0));
              await sleep(150);
              const top = await page.locator(anchor).boundingBox();
              if (!top) {
                misses.push(`${theme} ${name} NO COLUMN  ${route}`);
                continue;
              }
              clip = {
                x: Math.max(0, Math.round(top.x)),
                y: 0,
                width: Math.max(120, Math.round(top.width)),
                height: Math.max(90, Math.min(Math.round(top.height), TOP_SHOT, H)),
              };
            }
          }

          try {
            if (svg) await stamp(page, clip, svg);
            await sleep(70);
            await page.screenshot({ path: file, clip });
            await page.evaluate(() => {
              const old = document.getElementById("doc-shot-overlay");
              if (old) old.remove();
            });
          } catch (err) {
            misses.push(`${theme} ${name} SHOT FAILED  ${String(err).slice(0, 80)}`);
            continue;
          }
          done += 1;
          console.log(`  ok ${theme} ${name} ${clip.width}x${clip.height}`);
        }
      }
    }
    await context.close();
  }

  await browser.close();
  console.log(`captured ${done} of ${manifest.length * 2} files`);
  if (misses.length) {
    console.log("MISSING:");
    for (const miss of misses) console.log("  " + miss);
  }
})();
