const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting).forEach(entry => {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  reveals.forEach(element => observer.observe(element));
} else { reveals.forEach(element => element.classList.add("visible")); }

async function updateDownloads() {
  try {
    const response = await fetch("/api/releases");
    if (!response.ok) return;
    const releases = await response.json();
    for (const [app, release] of Object.entries(releases)) {
      if (!["phone", "mac"].includes(app)) continue;
      document.querySelectorAll(`[data-version="${app}"]`).forEach(element => {
        element.textContent = `v${release.version} · build ${release.build}`;
      });
      if (!release.available) continue;
      document.querySelectorAll(`[data-download="${app}"]`).forEach(link => {
        link.href = release.download;
        link.textContent = app === "phone" ? "Download for Android ↓" : "Download for Mac ↓";
      });
      let status = "Signed APK · Android 8+";
      if (app === "mac") {
        status = release.notarized === true ? "Signed & notarized · Apple Silicon + Intel · macOS 13+"
          : "Not notarized by Apple · Manual approval required · macOS 13+";
      }
      document.querySelectorAll(`[data-status="${app}"]`).forEach(element => {
        element.textContent = status;
      });
      const detail = document.querySelector(`[data-release="${app}"]`);
      if (detail) {
        detail.href = release.release;
        detail.textContent = "Release notes & checksums ↗";
      }
    }
  } catch { /* Source links remain usable when release metadata cannot be loaded. */ }
}
updateDownloads();
