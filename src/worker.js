const APPS = {
  phone: { repository: "phone-usage-tracker", extension: "apk", version: "1.1.1", build: 3 },
  mac: { repository: "mac-usage-tracker", extension: "dmg", version: "1.0.0", build: 1 },
};
const OWNER = "jerrylusato";
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60, s-maxage=300",
  "X-Content-Type-Options": "nosniff",
};

export function validateRelease(app, release, manifest) {
  const config = APPS[app];
  if (!config || release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) return null;
  if (manifest.app !== app || manifest.tag !== release.tag_name || manifest.version !== release.tag_name.slice(1)
    || !Number.isInteger(manifest.build) || manifest.build < 1 || !/^[a-f0-9]{40}$/.test(manifest.commit)) return null;
  const prefix = `https://github.com/${OWNER}/${config.repository}/releases/download/${release.tag_name}/`;
  const filename = app === "phone" ? `phone-usage-${manifest.version}.apk` : `mac-usage-${manifest.version}-universal.dmg`;
  const packageAsset = release.assets.find(asset => asset.name === filename);
  const checksumAsset = release.assets.find(asset => asset.name === "SHA256SUMS");
  const file = manifest.files?.find(item => item.name === filename);
  if (!packageAsset || !checksumAsset || !file || !/^[a-f0-9]{64}$/.test(file.sha256)
    || packageAsset.size !== file.size || file.size <= 0
    || packageAsset.browser_download_url !== prefix + filename
    || checksumAsset.browser_download_url !== prefix + "SHA256SUMS") return null;
  if (packageAsset.digest && packageAsset.digest !== "sha256:" + file.sha256) return null;
  return { version: manifest.version, build: manifest.build, tag: manifest.tag,
    download: packageAsset.browser_download_url, checksums: checksumAsset.browser_download_url,
    release: `https://github.com/${OWNER}/${config.repository}/releases/tag/${release.tag_name}`,
    sha256: file.sha256, size: file.size };
}

export async function loadRelease(app, request = fetch) {
  const config = APPS[app];
  const fallback = { version: config.version, build: config.build, available: false,
    source: `https://github.com/${OWNER}/${config.repository}` };
  try {
    const response = await request(`https://api.github.com/repos/${OWNER}/${config.repository}/releases/latest`, {
      headers: { "Accept": "application/vnd.github+json", "User-Agent": "Usage-website" }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return fallback;
    const release = await response.json();
    if (!Array.isArray(release.assets)) return fallback;
    const asset = release.assets.find(item => item.name === "release-manifest.json");
    const prefix = `https://github.com/${OWNER}/${config.repository}/releases/download/${release.tag_name}/`;
    if (!asset || asset.browser_download_url !== prefix + "release-manifest.json") return fallback;
    const manifestResponse = await request(asset.browser_download_url, { signal: AbortSignal.timeout(8000) });
    if (!manifestResponse.ok) return fallback;
    const validated = validateRelease(app, release, await manifestResponse.json());
    return validated ? { ...validated, available: true, source: fallback.source } : fallback;
  } catch { return fallback; }
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/releases") {
      if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
      return env.ASSETS.fetch(request);
    }
    if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    const key = new Request(`${url.origin}/api/releases`);
    const cached = await caches.default.match(key);
    let response = cached;
    if (!response) {
      const [phone, mac] = await Promise.all([loadRelease("phone"), loadRelease("mac")]);
      response = Response.json({ phone, mac }, { headers: HEADERS });
      context.waitUntil(caches.default.put(key, response.clone()));
    }
    return request.method === "HEAD" ? new Response(null, { headers: response.headers }) : response;
  },
};
