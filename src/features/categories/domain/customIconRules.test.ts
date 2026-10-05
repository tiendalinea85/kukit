import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOM_ICON_DATA_URL_PREFIX,
  CUSTOM_ICON_FALLBACK,
  CUSTOM_ICON_MAX_DATA_URL_CHARS,
  CUSTOM_ICON_MAX_NAME_LENGTH,
  MAX_ICONS_PER_IMPORT,
  buildCustomIcon,
  dedupeIconNames,
  iconNameFromFileName,
  iconText,
  isDataUrlIcon,
  isTextIcon,
  isValidIconDataUrl,
  normalizeCustomIconName,
  parseIconSetManifest,
} from "./customIconRules.ts";

const PNG = `${CUSTOM_ICON_DATA_URL_PREFIX}iVBORw0KGgo=`;
const WS = "ws-a";

describe("isDataUrlIcon / isTextIcon", () => {
  it("treats an emoji as text and a data url as an image", () => {
    assert.equal(isDataUrlIcon("🧵"), false);
    assert.equal(isTextIcon("🧵"), true);
    assert.equal(isDataUrlIcon(PNG), true);
    assert.equal(isTextIcon(PNG), false);
  });

  it("rejects an empty icon", () => {
    assert.equal(isTextIcon(""), false);
    assert.equal(iconText(undefined), CUSTOM_ICON_FALLBACK);
    assert.equal(iconText(""), CUSTOM_ICON_FALLBACK);
  });

  it("never prints a data url inside a select option", () => {
    assert.equal(iconText(PNG), CUSTOM_ICON_FALLBACK);
    assert.equal(iconText("🧵"), "🧵");
  });
});

describe("normalizeCustomIconName / iconNameFromFileName", () => {
  it("collapses spaces and caps the length", () => {
    assert.equal(normalizeCustomIconName("  logo   principal  "), "logo principal");
    assert.equal(normalizeCustomIconName("x".repeat(200)).length, CUSTOM_ICON_MAX_NAME_LENGTH);
  });

  it("drops the extension from the file name", () => {
    assert.equal(iconNameFromFileName("mi marca.png"), "mi marca");
    assert.equal(iconNameFromFileName("marca"), "marca");
  });

  it("falls back to a generic name when the file name is only an extension", () => {
    assert.equal(iconNameFromFileName(".png"), "icono");
  });
});

describe("isValidIconDataUrl", () => {
  it("accepts a png data url", () => {
    assert.equal(isValidIconDataUrl(PNG), true);
  });

  it("rejects other mime types, plain text and oversized payloads", () => {
    assert.equal(isValidIconDataUrl("data:image/jpeg;base64,AAA"), false);
    assert.equal(isValidIconDataUrl("hola"), false);
    assert.equal(isValidIconDataUrl("x".repeat(CUSTOM_ICON_MAX_DATA_URL_CHARS + 1)), false);
  });
});

describe("buildCustomIcon", () => {
  it("generates a uuid, keeps the workspace and marks it pending", () => {
    const icon = buildCustomIcon({
      data: { name: "  logo marca ", dataUrl: PNG },
      workspaceId: WS,
      now: "2026-10-05T10:00:00.000Z",
    });
    assert.match(icon.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(icon.workspaceId, WS);
    assert.equal(icon.name, "logo marca");
    assert.equal(icon.dataUrl, PNG);
    assert.equal(icon.deleted, false);
    assert.equal(icon.syncStatus, "pending");
    assert.equal(icon.updatedAt, "2026-10-05T10:00:00.000Z");
  });

  it("refuses a blank name or a non image payload", () => {
    assert.throws(
      () => buildCustomIcon({ data: { name: "   ", dataUrl: PNG }, workspaceId: WS, now: "2026-10-05T10:00:00.000Z" }),
      /nombre del icono es obligatorio/,
    );
    assert.throws(
      () => buildCustomIcon({ data: { name: "x", dataUrl: "no soy imagen" }, workspaceId: WS, now: "2026-10-05T10:00:00.000Z" }),
      /data URL/,
    );
  });
});

describe("parseIconSetManifest", () => {
  it("reads the plain array shape", () => {
    const { icons } = parseIconSetManifest(JSON.stringify([{ name: "a", dataUrl: PNG }]));
    assert.equal(icons.length, 1);
    assert.equal(icons[0].name, "a");
  });

  it("reads the { icons: [...] } wrapper", () => {
    const { icons } = parseIconSetManifest(JSON.stringify({ icons: [PNG] }));
    assert.equal(icons.length, 1);
    assert.equal(icons[0].name, "icono");
  });

  it("keeps the valid entries and counts the broken ones", () => {
    const { icons, skipped } = parseIconSetManifest(
      JSON.stringify([{ name: "a", dataUrl: PNG }, { name: "b", dataUrl: "roto" }, null]),
    );
    assert.equal(icons.length, 1);
    assert.equal(skipped, 2);
  });

  it("caps the import at the maximum size", () => {
    const many = Array.from({ length: MAX_ICONS_PER_IMPORT + 20 }, (_, i) => ({
      name: `icono ${i}`,
      dataUrl: PNG,
    }));
    assert.equal(parseIconSetManifest(JSON.stringify(many)).icons.length, MAX_ICONS_PER_IMPORT);
  });

  it("explains a malformed file", () => {
    assert.throws(() => parseIconSetManifest("no soy json"), /JSON válido/);
    assert.throws(() => parseIconSetManifest(JSON.stringify({ otro: 1 })), /lista de iconos/);
  });
});

describe("dedupeIconNames", () => {
  it("drops repeated names regardless of case", () => {
    const result = dedupeIconNames([
      { name: "Logo", dataUrl: PNG },
      { name: "logo", dataUrl: PNG },
      { name: "marca", dataUrl: PNG },
    ]);
    assert.deepEqual(result.map((i) => i.name), ["Logo", "marca"]);
  });
});