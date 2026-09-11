const $ = id => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1600);
}

function fmtDur(s) {
  if (!s) return "-";
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function fmtSize(b) {
  return b ? (b / 1048576).toFixed(1) + "MB" : "-";
}

// 从任意文本提取 BV 号
function extractBv(text) {
  const m = /BV[a-zA-Z0-9]{10}/.exec(text || "");
  return m ? m[0] : "";
}

let current = null; // 最近一次解析结果

// 设置：服务地址默认为空（部署好自建服务后再填）；engine = direct(插件直连B站) | server(自建服务)
let settings = { server: "", engine: "direct" };
chrome.storage.sync.get(settings, s => {
  settings = s;
  $("server").value = s.server;
  const radio = document.querySelector(`input[name="eng"][value="${s.engine}"]`);
  if (radio) radio.checked = true;
  updateSrvLink();
});

document.querySelectorAll('input[name="eng"]').forEach(r => {
  r.addEventListener("change", () => {
    settings.engine = r.value;
    chrome.storage.sync.set({ engine: r.value });
    toast(r.value === "server" ? "已切换：通过自建服务解析" : "已切换：插件直连B站");
  });
});

// 打开弹窗时：读当前标签页地址自动填 BV 和分P
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const u = tabs[0] && tabs[0].url || "";
  const bv = extractBv(u);
  if (bv) {
    $("bv").value = bv;
    const pm = /[?&]p=(\d+)/.exec(u);
    if (pm) $("p").value = pm[1];
    go();
  }
});

// 读取已保存的服务地址（默认值见上方 settings）
$("saveSrv").onclick = () => {
  const v = $("server").value.trim().replace(/\/+$/, "");
  settings.server = v;
  chrome.storage.sync.set({ server: v }, () => toast(v ? "服务地址已保存" : "已清除"));
};

$("go").onclick = go;
$("bv").addEventListener("keypress", e => { if (e.key === "Enter") go(); });

async function go() {
  const bv = extractBv($("bv").value) || $("bv").value.trim();
  if (!bv) { showErr("未能识别BV号"); return; }
  hideErr();
  $("card").style.display = "none";
  $("go").textContent = "解析中";
  $("go").disabled = true;
  try {
    const p = parseInt($("p").value || "1", 10);
    let res;
    if (settings.engine === "server") {
      res = await parseViaServer(bv, p);
    } else {
      res = await chrome.runtime.sendMessage({ type: "parse", bvid: bv, p });
    }
    if (!res || !res.ok) throw new Error(res && res.error || "解析失败");
    current = res.data;
    render(current);
  } catch (e) {
    showErr(e.message);
  } finally {
    $("go").textContent = "解析";
    $("go").disabled = false;
  }
}

// 自建服务解析：服务端同样返回 code/data 结构，字段名略有差异，这里做映射
async function parseViaServer(bv, p) {
  if (!settings.server) throw new Error("未配置服务地址，请在下方填写或切换为插件直连");
  const api = `${settings.server}/api?id=${encodeURIComponent(bv)}&p=${p}&format=json`;
  const r = await fetch(api);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg || "服务解析失败");
  const d = j.data;
  return {
    ok: true,
    data: {
      bvid: d.bvid, title: d.title, owner: d.owner, pic: d.pic,
      pages: [{ page: d.page, cid: 0, part: d.part }],
      page: d.page, part: d.part,
      url: d.url, quality: d.quality, qualityLabel: d.quality_label,
      timelength: d.duration_ms, size: d.size,
    },
  };
}

function render(d) {
  $("pic").src = d.pic;
  $("title").textContent = d.title;
  $("meta").textContent =
    `UP: ${d.owner} · ${d.qualityLabel} · P${d.page} · ${fmtDur(d.timelength / 1000)} · ${fmtSize(d.size)}`;
  $("direct").textContent = d.url;
  updateSrvLink();
  $("card").style.display = "block";

  // 自动复制跟随解析引擎：直连→CDN直链(1h有效)；自建服务→稳定服务链接(不过期)
  const srv = $("server").value.trim().replace(/\/+$/, "");
  if (settings.engine === "server" && srv) {
    copy(`${srv}/api?id=${d.bvid}&p=${d.page}`, "已自动复制服务链接（不过期）");
  } else {
    copy(d.url, "已自动复制CDN直链（1小时内有效）");
  }
}

function updateSrvLink() {
  const srv = $("server").value.trim().replace(/\/+$/, "");
  $("srvlink").textContent = srv && current
    ? `${srv}/api?id=${current.bvid}&p=${current.page}`
    : "（先在下方填写并保存服务地址）";
}

$("server").addEventListener("input", updateSrvLink);

async function copy(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    // 降级方案
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast(okMsg);
  }
}

$("copyDirect").onclick = () => current && copy(current.url, "CDN直链已复制（1小时内有效）");
$("copySrv").onclick = () => {
  const t = $("srvlink").textContent;
  if (t.startsWith("http")) copy(t, "服务链接已复制");
  else toast("请先填写并保存服务地址");
};

function showErr(m) { $("err").textContent = m; $("err").style.display = "block"; }
function hideErr() { $("err").style.display = "none"; }
