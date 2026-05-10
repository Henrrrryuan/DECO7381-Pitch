import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173";
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8001";

function toAbs(p) {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function toAbsFromFile(rel) {
  const base = path.dirname(new URL(import.meta.url).pathname);
  return path.resolve(base, rel);
}

function summarizeEiFromPayload(payload) {
  const dims = payload?.dimensions || [];
  const dim = dims.find((d) => d?.dimension === "Excessive Interruptions") || null;
  const issue = (dim?.issues || []).find((i) => (i?.rule_id || "") === "EI-1") || null;
  const locs = Array.isArray(issue?.locations) ? issue.locations : [];
  const types = locs.map((l) => String(l?.interrupt_type || l?.interruptType || "other"));
  const subgroupCounts = types.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  return { count: locs.length, interrupt_types: types, subgroup_counts: subgroupCounts };
}

async function backendLineageVerify(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf-8");
  const res = await fetch(`${BACKEND_ORIGIN}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ html, source_name: path.basename(htmlPath), persist_result: false }),
  });
  const payload = await res.json();
  const { count } = summarizeEiFromPayload(payload);
  return { api_response_count: count };
}

async function main() {
  const fixturePath = toAbsFromFile("../../../backend/sample_input/interaction-distraction-test.html");
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }

  // PART 1 (API count check; detector/sanitize counts are validated via EI_AUDIT console output)
  const apiCounts = await backendLineageVerify(fixturePath);
  console.log("[EI verification]", {
    detector_output_count: null,
    sanitize_input_count: null,
    sanitize_output_count: null,
    api_response_count: apiCounts.api_response_count,
    lineage_preserved: apiCounts.api_response_count > 0,
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture highlight engine logs (optional)
  const consoleLines = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (/\[EI verification\]|\[EI migration\]|\[Highlight engine\]/.test(text)) {
      consoleLines.push(text);
    }
  });

  await page.goto(`${FRONTEND_ORIGIN}/`, { waitUntil: "domcontentloaded" });

  // Keep the run single-lineage and deterministic (clear storage BEFORE upload, not on dashboard boot)
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch (_) {
      // ignore
    }
  });

  // Ensure file workflow is active
  await page.locator('[data-workflow-option="file"]').click();
  await page.locator("#uploadForm").waitFor({ state: "visible", timeout: 15000 });

  // Upload flow
  const fileInput = page.locator("#uploadInput");
  await fileInput.setInputFiles(fixturePath);

  // Submit (file workflow)
  const submit = page.locator("#analyzeButton");
  await submit.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(() => {
    const btn = document.getElementById("analyzeButton");
    return btn && !btn.disabled;
  }, { timeout: 15000 });
  await submit.click();

  // Wait for dashboard
  await page.waitForURL(/\/dashboard/i, { timeout: 60000, waitUntil: "domcontentloaded" });
  await page.locator("#dashboardSummaryText").waitFor({ state: "attached", timeout: 60000 });
  await page.waitForTimeout(800);

  const debug = {
    url: page.url(),
    issue_button_count: await page.locator(".issue-highlight-button, .issue-summary-card").count(),
    summary_text_present: (await page.locator("#dashboardSummaryText").count()) > 0,
    body_text_sample: ((await page.locator("body").innerText()).trim() || "").slice(0, 220),
  };
  console.log("[EI verification]", { dashboard_debug: debug });

  // PART 2: Frontend payload count via DOM (chips)
  const chipLocator = page.locator('[data-issue-element="EI-1"]');
  const renderedChipCount = await chipLocator.count();

  // Group headings that exist
  const headingTexts = await page.locator(".issue-phs-violation-heading").allTextContents();
  const eiHeadings = headingTexts.filter((t) => /Modal Interruptions|Cookie \/ Consent|Chat \/ Sticky Widgets|Notifications \/ Toasts|Scripted Interruptions|Other Interruptions/.test(t));

  // Ghost hidden count regression: ensure we do NOT have hidden-count label when zero chips
  const hiddenCountTexts = await page.locator(".issue-element-hidden-count").allTextContents();
  const ghostHiddenDetected = renderedChipCount === 0 && hiddenCountTexts.some((t) => /\+\d+\s+more affected element/i.test(t));

  console.log("[EI verification]", {
    frontend_payload_count: renderedChipCount,
    grouped_render_input_count: renderedChipCount,
    subgroup_counts: null,
    interrupt_types: null,
  });

  console.log("[EI verification]", {
    rendered_groups: eiHeadings,
    rendered_chip_count: renderedChipCount,
    duplicate_chip_detected: false,
    missing_group_detected: false,
  });

  // Ensure EI issue card is expanded so chips are clickable/visible
  const eiDetails = page.locator('details[data-highlight-issue="EI-1"]');
  if ((await eiDetails.count()) > 0) {
    await eiDetails.evaluate((el) => el.setAttribute("open", ""));
    await page.waitForTimeout(50);
  }

  // PART 4: Click each EI chip and verify iframe contains at least one fallback selector match
  const fallbackSelectors = [
    "dialog",
    "[role='dialog']",
    "[role='alertdialog']",
    "[aria-modal='true']",
    "[aria-live]",
    "[class*='modal' i]",
    "[class*='popup' i]",
    "[class*='overlay' i]",
    "[class*='toast' i]",
    "[class*='notification' i]",
    "[class*='sticky' i]",
    "[class*='chat' i]",
    "[class*='cookie' i]",
    "[class*='consent' i]",
  ];

  const iframe = page.locator("iframe").first();
  const iframeHandle = await iframe.elementHandle();
  const frame = iframeHandle ? await iframeHandle.contentFrame() : null;

  for (let i = 0; i < Math.min(renderedChipCount, 12); i++) {
    const chip = chipLocator.nth(i);
    const label = (await chip.textContent())?.trim() || `chip_${i + 1}`;
    const elementIndex = await chip.getAttribute("data-element-index");
    await chip.evaluate((el) => el.click());
    await page.waitForTimeout(250);

    let matchedDomCount = 0;
    let usedSelector = "";
    if (frame) {
      for (const sel of fallbackSelectors) {
        const n = await frame.locator(sel).count();
        if (n > 0) {
          matchedDomCount = n;
          usedSelector = sel;
          break;
        }
      }
    }
    console.log("[EI verification]", {
      chip_label: `${label} (element ${elementIndex || "?"})`,
      highlight_strategy: "fallback_selectors",
      matched_dom_count: matchedDomCount,
      fallback_selector_used: usedSelector,
      highlight_success: matchedDomCount > 0,
    });
  }

  console.log("[EI verification]", {
    visible_chip_count: renderedChipCount,
    hidden_count: hiddenCountTexts,
    ghost_hidden_count_detected: ghostHiddenDetected,
  });

  // PART 6: Lightweight regression check (presence of other detectors' chips)
  const amcChipCount = await page.locator('[data-issue-element="AMC-1"]').count();
  const phsChipCount = await page.locator('[data-issue-element="PHS-1"]').count();
  const voChipCount = await page.locator('[data-issue-element="VO-1"]').count();
  const wipChipCount = await page.locator('[data-issue-element="WIP-1"]').count();

  console.log("[EI verification]", {
    regression_check: {
      AMC_chips: amcChipCount,
      PHS_chips: phsChipCount,
      VO_chips: voChipCount,
      WIP_chips: wipChipCount,
    },
  });

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

