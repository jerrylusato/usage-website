import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRelease, validateRelease } from "../src/worker.js";

function fixture(app = "phone") {
  const version = app === "phone" ? "1.1.1" : "1.0.0";
  const repo = app === "phone" ? "phone-usage-tracker" : "mac-usage-tracker";
  const filename = app === "phone" ? `phone-usage-${version}.apk` : `mac-usage-${version}-universal.dmg`;
  const prefix = `https://github.com/jerrylusato/${repo}/releases/download/v${version}/`;
  const release = { tag_name: "v" + version, draft: false, prerelease: false, assets: [
    { name: filename, browser_download_url: prefix + filename, size: 100, digest: "sha256:" + "a".repeat(64) },
    { name: "SHA256SUMS", browser_download_url: prefix + "SHA256SUMS" },
    { name: "release-manifest.json", browser_download_url: prefix + "release-manifest.json" },
  ] };
  const manifest = { app, version, tag: release.tag_name, build: 1, commit: "b".repeat(40),
    files: [{ name: filename, sha256: "a".repeat(64), size: 100 }] };
  if (app === "mac") Object.assign(manifest, { signing: "ad-hoc", notarized: false });
  return { release, manifest };
}

test("accepts valid immutable Android and universal Mac release assets", () => {
  for (const app of ["phone", "mac"]) {
    const { release, manifest } = fixture(app);
    assert.equal(validateRelease(app, release, manifest).version, manifest.version);
  }
});
test("rejects draft and prerelease downloads", () => {
  for (const flag of ["draft", "prerelease"]) {
    const { release, manifest } = fixture();
    release[flag] = true;
    assert.equal(validateRelease("phone", release, manifest), null);
  }
});
test("rejects mismatched version, app, build, hash, size, or source commit", () => {
  for (const mutate of [m => m.version = "9.9.9", m => m.app = "mac", m => m.build = 0,
    m => m.commit = "main", m => m.files[0].sha256 = "invalid", m => m.files[0].size = 999]) {
    const { release, manifest } = fixture();
    mutate(manifest);
    assert.equal(validateRelease("phone", release, manifest), null);
  }
});
test("rejects external download destinations and digest mismatches", () => {
  for (const mutate of [r => r.assets[0].browser_download_url = "https://example.com/app.apk",
    r => r.assets[0].digest = "sha256:" + "c".repeat(64)]) {
    const { release, manifest } = fixture();
    mutate(release);
    assert.equal(validateRelease("phone", release, manifest), null);
  }
});
test("missing checksums cannot become a download", () => {
  const { release, manifest } = fixture();
  release.assets = release.assets.filter(asset => asset.name !== "SHA256SUMS");
  assert.equal(validateRelease("phone", release, manifest), null);
});
test("GitHub outages and missing releases preserve source links", async () => {
  for (const request of [async () => new Response(null, { status: 404 }), async () => { throw new Error("offline"); }]) {
    const result = await loadRelease("phone", request);
    assert.equal(result.available, false);
    assert.equal(result.version, "1.1.1");
    assert.equal(result.source, "https://github.com/jerrylusato/phone-usage-tracker");
  }
});
test("loads a valid release manifest and exposes its package", async () => {
  const { release, manifest } = fixture();
  let calls = 0;
  const result = await loadRelease("phone", async () => Response.json(calls++ === 0 ? release : manifest));
  assert.equal(result.available, true);
  assert.match(result.download, /phone-usage-1\.1\.1\.apk$/);
});

test("Mac signing status is explicit and consistent", () => {
  for (const [signing, notarized] of [["ad-hoc", false], ["developer-id", true]]) {
    const { release, manifest } = fixture("mac");
    Object.assign(manifest, { signing, notarized });
    const result = validateRelease("mac", release, manifest);
    assert.equal(result.signing, signing);
    assert.equal(result.notarized, notarized);
  }
  for (const [signing, notarized] of [[undefined, undefined], ["ad-hoc", true],
    ["developer-id", false], ["ad-hoc", "false"], ["unknown", false]]) {
    const { release, manifest } = fixture("mac");
    Object.assign(manifest, { signing, notarized });
    assert.equal(validateRelease("mac", release, manifest), null);
  }
});
