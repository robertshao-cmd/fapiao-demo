# 這包是什麼 · 5 分鐘開工

**發票載具 demo 的完整可攜快照**(整個 repo 去掉 .git),源頭=GitHub
`robertshao-cmd/fapiao-demo`(commit 見 `MANIFEST.txt`)。零建置,解壓即跑。

## 開工三步

```bash
python -m http.server 8125          # 1. 起服(一定要 HTTP,file:// 聯動會靜默失效)
# 2. 開 http://localhost:8125/merchant.html → 一鍵登入(你的主戰場)
python checks/verify-demo.py        # 3. 改了商家端四檔必跑,exit 0 才算完成
```

## 讀的順序

1. `AGENTS.md` — 硬規則、檔案地圖、BroadcastChannel 協定表
2. `docs/HANDOFF.md` — 產品決策(已拍板勿重開)、阻塞、後續開發候選(第一名=參謀真資料注入縫)

## 入口地圖(整個 demo 有三條進法)

| 入口 | 鏈 | 地盤 |
|---|---|---|
| **商家端**(你的工作範圍) | `merchant.html` 登入 → 四頁籤:助手/參謀/用戶端預覽(`user.html`)/**載具首頁**(`real-home-v7.html?embed=1`,0729 新增) | ✅ 可改 |
| App 首頁(對主管演「裝在載具 App 裡的樣子」) | `real-home-v7.html`(真實截圖殼,吃 `invoicemanager_screens_assets/`)→ 小程序架 → `user-nopay-v6.19.html?open=…`(舊單體,0729 已從斷鏈的 v6.9 改指 v6.19) | 🔒 唯讀(embed CSS 除外) |
| 小程序架(新模組化版) | `mini/index.html` → `mini/detox\|bored\|wealth`(hash 戳記在 `mini/MANIFEST.json`) | 🔒 唯讀(另一工作流的建置產物) |
| 總導覽 | `index.html`(QR 頁,四條都連) | 🔒 唯讀 |

⚠️ **已知接縫(不是 bug,不要「修」)**:
- `real-home-v7.html` 的小程序架開的是舊單體(`user-nopay-v6.19.html`),還沒改接新的 `mini/`
  ——要不要重接是產品決定,回報 Robert,不要自作主張
- 架上「暖暖窩點單」磚開的是裸網域 `dotdao-eat.cmoney.tw`(真店 shopId 還沒拿到,
  拿到後改成 `/{shopId}/order` 一行搞定)——不要用假 UUID 填
`user-nopay-v6.0～v6.19`、`app.html`、`b/`、`d/` 都是歷史版本或別的工作流,一律唯讀。

## 改完怎麼交回來

1. 跑 `python checks/verify-demo.py` 確認 exit 0
2. 把整包 zip 回傳(或只列改過的檔)——`MANIFEST.txt` 有每個檔的 sha256,
   回來這邊 diff 一下就知道你動了哪些,直接合回 git repo
3. **不要**在這包裡試圖 git push(快照沒有 .git,發佈由源頭 repo 的 main 分支負責)
