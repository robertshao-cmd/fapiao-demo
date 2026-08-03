# fapiao-demo — Agent 工作契約

發票載具(統一發票 App)的 **demo 部署包**。純靜態、零建置、每個 HTML 自包含
(CSS/JS 全 inline,無外部依賴)——**保持這樣,不要引入 build step 或 CDN**。

完整產品脈絡與當前狀態:**先讀 `docs/HANDOFF.md`**。
(根目錄 `README.txt` 是 0717 的歷史部署說明,指向舊 repo chinwei0127-abc/fapiao-test——
已過時,發佈以本檔 Git 規則為準:本 repo=robertshao-cmd/fapiao-demo,push main 即上 Pages。)

## 檔案地圖

| 檔 | 角色 | 版本 |
|---|---|---|
| `merchant.html` | **商家工作台(殼)**:登入 → 底部三分頁 iframe 載入下面三個 | v4.3 |
| `merchant-app.html` | 商家助手(開店/接單/數據/會員/增長) | v3.6 |
| `merchant-analytics.html` | 生意參謀(總覽/行業/客戶/競對/對比) | v1.3 |
| `user.html` | 用戶端小程序(殼的第三分頁也載它,`?store=nuan`) | v6.0 |
| `index.html` | demo 入口(QR 導覽頁) |  |
| `mini/`, `b/`, `d/`, `app.html`, `user-nopay-*.html`, `real-home-v7.html` | **別的工作流的地盤,未被指派不要動** |  |
| `checks/verify-demo.py` | 商家端驗收閘門 |  |
| `docs/HANDOFF.md` | 產品決策、範圍、阻塞、後續候選 |  |
| `docs/TEST-STEPS.md` | 逐步測試表 + 消費鏈路全圖(ASCII) |  |
| `docs/PAYMENT-METHODS.md` | 付款方式整合現況/方法論/兩側該問誰 |  |
| `jsQR.js` | 本地 vendor 的 QR 解碼庫(Apache-2.0,不走 CDN) |  |

## 跑起來

```bash
python -m http.server 8125 --directory .
# → http://localhost:8125/merchant.html
```

**BroadcastChannel 同源才通**:`file://` 直開頁面會正常渲染,但雙端聯動(下單/發券)全部靜默失效。
測聯動一律走 HTTP。

## 同步(這個 repo 有多個工作流在推,開工前先拉)

```bash
git pull --rebase --autostash && python checks/verify-demo.py
```

## 交付前必過(機制,不是提醒)

```bash
python checks/verify-demo.py    # exit 0 才算完成
```

它擋的是這個 repo 實際踩過的雷:過期的未來日期、跨檔數字打架、統編不一致、
「標杆店」措辭回滲、HTML/JS 壞損。改了商家端四檔任何一個都要跑。

## 硬規則

1. **口徑(0728 Melon 拍板)**:對標基準=「商圈前 25% 聚合均值(去識別化,不指向任何單一店家)」。
   L0/L1 區塊**禁止**出現單一「標杆店」或可識別他店的內容;競對分頁(L3)保留當展示樓梯,MVP 不實作。
2. **日期**:開獎日=單數月 25 日(1/3/5/7/9/11 月)。任何以未來語氣寫的日期不得已過期;
   demo 裡的「今日」「本週」要貼近當下。verify 會查。
3. **數字一致**:同一指標在助手與參謀要相同——30 天回購 34%、商圈均值 27%、回頭客 59%/新客 41%。
   改一處就要改另一處(verify 會查)。
4. **統編 24567890** 三處一致(殼登入頁、殼 topbar、助手開店頁)。
5. **示範標記**:所有假資料的「(示範)」字樣保留,不得讓 demo 內容看起來像真實營業數據。
6. **embed 契約**:`?embed=1` 隱藏 stage-head/rail/foot/mcap;殼靠它嵌 iframe。改版面先確認兩種模式都對。
7. **Git**:`push main = 直接發佈 GitHub Pages`(robertshao-cmd.github.io/fapiao-demo,HTML cache 600s)。
   這個 repo 有多個 session 同時工作——**commit 只加你改的路徑,不要 `git add -A`**。
   不 push 除非使用者明說。

## BroadcastChannel 協定(頻道名 `fapiao-demo`)

| type | 方向 | payload | 收端行為 |
|---|---|---|---|
| `order` | 用戶→商家 | `{o:{code,paid,mode,table,items:[{name,qty}],storeName,coupon}}` | 助手:進看板+toast;參謀:toast |
| `status` | 商家→用戶 | `{code,stage:"ready"}` | 用戶:訂單跳「請取餐」 |
| `coupon` | 商家→用戶 | `{c:{store,storeName,title,sub,tag,amt,min}}` | 用戶:券夾插入+toast |
| `present` | 用戶→商家 | `{p:{id,title,tag,sub,storeName,amt,min}}` | 助手:核銷台亮+跳訂單頁 |
| `redeem` | 商家→用戶 | `{id}` | 用戶:該券標已使用+toast |
| `paymode` | 商家→用戶 | `{on:bool}` | 用戶:切線上付款/到店付 |
| `member` | 用戶→商家 | `{m:{name,phone,no}}` | 助手:會員+1;參謀:toast |
| `queue`/`booking` | 用戶→商家 | `{q:{storeName,no,size}}` / `{b:{name,svc,time}}` | 助手:toast |

## 升級路徑(誰決定什麼)

- 產品範圍/口徑/文案方向 → Robert(向 Melon 對齊),不要自行擴 scope
- 真資料串接**不在這個 repo**:點到訂單 API、發票 rawdata 都在別處(見 HANDOFF「相關 repo 地圖」)
