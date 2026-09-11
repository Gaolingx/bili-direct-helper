// 后台 Service Worker：借助 host_permissions 绕过 CORS 直接调 B 站接口
// 流程与自建服务一致: BV号 -> view接口取cid -> playurl接口取签名直链

const QUALITY_MAP = { 16: "360P", 32: "480P", 64: "720P", 80: "1080P" };

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "parse") {
    parseVideo(msg.bvid, msg.p || 1)
      .then(sendResponse)
      .catch(e => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true; // 异步应答
  }
});

async function getMeta(bvid) {
  const r = await fetch(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(`B站接口: ${j.message} (code=${j.code})`);
  const d = j.data;
  return {
    bvid: d.bvid,
    title: d.title,
    owner: d.owner.name,
    pic: d.pic,
    duration: d.duration,
    pages: d.pages.map(p => ({ page: p.page, cid: p.cid, part: p.part || "" })),
  };
}

async function getPlayUrl(bvid, cid) {
  const r = await fetch(
    `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&platform=html5&high_quality=1`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(`playurl: ${j.message} (code=${j.code})`);
  const d = j.data;
  return {
    url: d.durl[0].url,
    quality: d.quality,
    qualityLabel: QUALITY_MAP[d.quality] || String(d.quality),
    timelength: d.timelength,
    size: d.durl[0].size,
  };
}

async function parseVideo(bvid, p) {
  const meta = await getMeta(bvid);
  const page = meta.pages.find(x => x.page === p) || meta.pages[0];
  const play = await getPlayUrl(meta.bvid, page.cid);
  return { ok: true, data: { ...meta, page: page.page, part: page.part, ...play } };
}
