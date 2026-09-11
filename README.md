# B站视频直链助手 (bili-direct-helper)

> 一键解析 B 站视频 CDN 直链，免登录获取 720P 播放地址，复制给 VRChat 等播放器使用；也可对接自建解析服务生成不过期的稳定链接。

一个基于 **Manifest V3** 的浏览器扩展（Chrome / Edge），通过 B 站公开接口解析视频真实播放地址，无需登录即可拿到 720P 直链。

---

## ✨ 功能特性

- **一键解析**：打开任意 B 站视频页，点击扩展图标即自动填充 BV 号与分 P 并解析。
- **CDN 直链**：输出带签名的 `.m4s` 直链（约 1 小时有效），可直接粘贴到 VRChat、PotPlayer、MPV 等播放器。
- **自动复制**：解析完成后自动复制链接到剪贴板，去播放器直接粘贴即可。
- **两种解析引擎**
  - **插件直连**：利用扩展 `host_permissions` 绕过 CORS，直接调用 B 站接口，开箱即用。
  - **自建服务**：对接你自己的解析服务，生成稳定、不过期的链接（适合长期分享）。
- **分 P 支持**：识别 `?p=` 参数，可手动指定分 P。
- **视频信息**：展示封面、标题、UP 主、清晰度、时长与文件大小。
- **深色 UI**：采用 B 站主题粉色的现代深色界面。

---

## 📦 安装

本项目未发布到应用商店，请以「开发者模式」加载：

1. 下载或克隆本仓库：
   ```bash
   git clone https://github.com/<your-name>/bili-direct-helper.git
   ```
2. 打开浏览器扩展管理页：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
3. 打开右上角 **开发者模式**。
4. 点击 **加载已解压的扩展程序**，选择仓库中的 **`src`** 目录。
5. 扩展图标出现在工具栏即安装成功。

---

## 🚀 使用方法

1. 打开任意 B 站视频页面（如 `https://www.bilibili.com/video/BVxxxxxxxxxx`）。
2. 点击工具栏中的扩展图标，弹窗会自动填入 BV 号并开始解析。
3. 解析完成后：
   - **CDN 直链**：已自动复制，直接粘贴到播放器即可（约 1 小时内有效）。
   - **自建服务链接**：若配置了服务地址，会自动复制不过期的稳定链接。
4. 也可手动在输入框粘贴 **BV 号或完整 B 站链接**，并指定分 P 后点击「解析」。

### 配置自建服务（可选）

1. 在弹窗底部填写你的服务地址（如 `https://bili.example.com`）并点击 **保存**。
2. 在「解析引擎」中切换到 **自建服务**。
3. 之后解析将调用 `${服务地址}/api?id=<BV号>&p=<分P>&format=json`，返回稳定链接。

---

## 🔌 自建服务接口约定

扩展期望服务端返回如下 JSON（与 B 站 `code/data` 结构保持一致）：

**请求**

```
GET {服务地址}/api?id={BV号}&p={分P}&format=json
```

**响应**

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "bvid": "BV1xx411c7mD",
    "title": "视频标题",
    "owner": "UP主名字",
    "pic": "https://i0.hdslb.com/bfs/archive/xxx.jpg",
    "page": 1,
    "part": "P1 标题",
    "url": "https://.../video.m4s",
    "quality": 64,
    "quality_label": "720P",
    "duration_ms": 123000,
    "size": 12345678
  }
}
```

- `code` 为 `0` 表示成功，非 `0` 时扩展会显示 `msg`。
- 返回链接应指向**长期有效**的地址（例如服务端代理转发，而非会过期的 B 站签名直链）。

### 清晰度对照

| quality | 清晰度 |
| ------- | ------ |
| 16      | 360P   |
| 32      | 480P   |
| 64      | 720P   |
| 80      | 1080P  |

---

## 🧩 项目结构

```
bili-direct-helper/
├── README.md
└── src/                     # 扩展根目录（加载时选择此目录）
    ├── manifest.json        # Manifest V3 配置
    ├── background.js        # Service Worker：直连 B 站接口解析
    ├── popup.html           # 弹窗界面
    ├── popup.js             # 弹窗逻辑与两种解析引擎
    └── icons/               # 扩展图标 (16/48/128)
```

---

## ⚙️ 工作原理

插件直连模式流程（与自建服务一致）：

```
BV号 ──▶ view 接口(取 cid) ──▶ playurl 接口(取签名直链) ──▶ CDN .m4s 直链
```

- **`background.js`**（Service Worker）利用扩展的 `host_permissions` 绕过浏览器 CORS 限制，直接请求：
  - `https://api.bilibili.com/x/web-interface/view?bvid=...` 获取视频元信息与 `cid`。
  - `https://api.bilibili.com/x/player/playurl?bvid=...&cid=...&platform=html5&high_quality=1` 获取签名直链。
- **`popup.js`** 负责 UI 交互、BV 号提取、两种引擎切换与剪贴板复制。

### 权限说明

| 权限                         | 用途                             |
| ---------------------------- | -------------------------------- |
| `activeTab`                  | 读取当前标签页 URL 以自动填充 BV |
| `storage`                    | 保存服务地址与解析引擎偏好       |
| `host_permissions`（B 站）   | 直连调用 B 站公开接口            |

---

## ⚠️ 注意事项

- B 站签名直链**约 1 小时后失效**，且可能与 IP / UA 绑定；需要长期有效链接请部署自建服务。
- 插件面向**个人学习与自用**，请勿用于商业用途或大规模爬取。
- 免登录最高清晰度为 **720P**，更高清晰度需要登录态。
- 若接口返回错误，请检查 BV 号是否正确，或稍后重试。

---

## 📄 许可证

本项目仅供学习交流使用。使用本工具产生的任何后果由使用者自行承担，请遵守 B 站用户协议与相关法律法规。
