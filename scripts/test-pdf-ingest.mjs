#!/usr/bin/env node
// Headless verification of the PDF → package ingestion pipeline (Track 1b).
// For each sample PDF: pdfjs text extraction → ONE OpenRouter LLM call →
// mapped package (basic attrs + editor data blob) printed to stdout.
//
//   node scripts/test-pdf-ingest.mjs [pdf-dir]
//
// Reads OPENROUTER_API_KEY from .env at the repo root.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import {
  extractTextWithLib,
  renderPdfPagesWithLib,
  textTooThin,
  analyzePdf,
  buildPackageData,
  diffTaxonomy,
} from "../src/services/pdfIngest.js";

// pdf.js rendering in node needs these DOM globals (@napi-rs/canvas provides them)
globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
globalThis.Path2D ??= Path2D;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pdfDir = resolve(process.argv[2] || join(root, "..", "..", "resources", "package-pdf"));

const envText = readFileSync(join(root, ".env"), "utf8");
const apiKey = envText.match(/^OPENROUTER_API_KEY=(.+)$/m)?.[1]?.trim();
if (!apiKey) {
  console.error("OPENROUTER_API_KEY introuvable dans .env");
  process.exit(1);
}

// Same options the CreatePackageModal offers — used for the taxonomy diff.
const COUNTRY_OPTIONS = [
  "Maroc", "France", "Espagne", "Italie", "Turquie",
  "Égypte", "Thaïlande", "Émirats Arabes Unis", "Portugal", "Grèce",
  "Maldives", "Japon", "Indonésie", "Mexique", "États-Unis",
];
const CONTINENTS = ["Europe", "Asie", "Afrique", "Amériques", "Océanie"];

const files = readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith(".pdf"));
if (!files.length) {
  console.error(`Aucun PDF dans ${pdfDir}`);
  process.exit(1);
}

const outDir = join(root, "scripts", "out");
mkdirSync(outDir, { recursive: true });

let failures = 0;
for (const file of files) {
  const label = file.length > 60 ? file.slice(0, 57) + "…" : file;
  console.log(`\n${"═".repeat(70)}\n▶ ${label}\n${"═".repeat(70)}`);
  try {
    const raw = readFileSync(join(pdfDir, file));
    const t0 = Date.now();
    const text = await extractTextWithLib(pdfjsLib, new Uint8Array(raw));
    let images = [];
    if (textTooThin(text)) {
      images = await renderPdfPagesWithLib(pdfjsLib, new Uint8Array(raw), {
        createCanvas,
        encode: (canvas) =>
          `data:image/jpeg;base64,${canvas.toBuffer("image/jpeg", 80).toString("base64")}`,
      });
    }
    console.log(
      `extraction: ${text.length} caractères` +
        (images.length ? ` + ${images.length} pages rasterisées (scan sans texte)` : "") +
        ` (${Date.now() - t0} ms)`
    );

    const t1 = Date.now();
    const llm = await analyzePdf({ text, images }, { apiKey });
    console.log(`analyse LLM: ok via ${llm._model} (${Date.now() - t1} ms)`);

    const data = buildPackageData(llm, { title: llm.basic?.title });
    const { matches, missing } = diffTaxonomy(llm.basic || {}, {
      countryOptions: COUNTRY_OPTIONS,
      continents: CONTINENTS,
      destinations: [], // no backend here — every destination shows as "missing"
      tours: [],
      adventures: [],
    });

    const mapped = { basic: llm.basic, taxonomy: { matches, missing }, data };
    console.log(JSON.stringify(mapped, null, 2));

    const outFile = join(outDir, file.replace(/\.pdf$/i, "") + ".json");
    writeFileSync(outFile, JSON.stringify(mapped, null, 2));

    // Coherence summary
    console.log(
      `\n✓ résumé: titre="${llm.basic?.title}" pays=${llm.basic?.country} ` +
        `continent=${llm.basic?.continent} prix=${llm.basic?.basePrice} | ` +
        `sections=${data.sections.length} jours=${data.days.length} ` +
        `formules=${data.hotelCategories.length} ` +
        `(hôtels=${data.hotelCategories.reduce((n, c) => n + c.hotels.length, 0)}) ` +
        `dates=${data.departureDates.length} suppléments=${data.suppliments.length}`
    );
  } catch (e) {
    failures++;
    console.error(`✗ ÉCHEC: ${e.message}`);
  }
}

console.log(`\n${files.length - failures}/${files.length} PDFs traités avec succès.`);
process.exit(failures ? 1 : 0);
