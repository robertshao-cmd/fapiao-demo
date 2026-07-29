# 這包是什麼 · 5 分鐘開工

**發票載具「商家端」demo 的可攜快照**,源頭=GitHub `robertshao-cmd/fapiao-demo`
(commit 見 `MANIFEST.txt`)。所有檔案自包含(無外部依賴、零建置),解壓即跑。

## 開工三步

```bash
python -m http.server 8125          # 1. 起服(一定要 HTTP,file:// 聯動會靜默失效)
# 2. 開 http://localhost:8125/merchant.html → 一鍵登入
python checks/verify-demo.py        # 3. 改完必跑,exit 0 才算完成
```

## 讀的順序

1. `AGENTS.md` — 硬規則、檔案地圖、BroadcastChannel 協定表
2. `docs/HANDOFF.md` — 產品決策(已拍板勿重開)、阻塞、後續開發候選(第一名=參謀真資料注入縫)

## 這包刻意不含的

`mini/`、`app.html`、`real-home-v7.html`、`b/`、`d/`、`user-nopay-*` ——別的工作流的檔案。
`index.html` 上指向它們的連結在這包裡會 404,**是預期的**,不要去「修」。

## 改完怎麼交回來

1. 跑 `python checks/verify-demo.py` 確認 exit 0
2. 把整包 zip 回傳(或只列改過的檔)——`MANIFEST.txt` 有每個檔的 sha256,
   回來這邊 diff 一下就知道你動了哪些,直接合回 git repo
3. **不要**在這包裡試圖 git push(快照沒有 .git,發佈由源頭 repo 的 main 分支負責)
