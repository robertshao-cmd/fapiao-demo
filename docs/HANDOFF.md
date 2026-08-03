# 商家端(biz app)開發交接包 — 2026-07-28

> 自包含:讀完這份+根目錄 `AGENTS.md`,不需要存取其他 repo 就能安全開工。
> 其他 repo 的路徑只是「真資料串接時才需要」的參照。

## 一、這是什麼

CMoney「發票載具」App 要把微信小程序的商業模式搬進來(本地生活平台,BO=Melon/胡晉瑋)。
這個 repo 是**對商家與主管的展示層**:證明「用戶下單 → 商家接單 → 數據回寫」閉環的體感。
真正的生產系統(點餐)是另一團隊的「點到」(small-shop),**絕不在這裡寫生產 code**。

商家端三件套(0728 Melon 拍板:**直接沿用這套 demo,不重寫**):

```
merchant.html(殼:一個主帳號,登入一次)
 ├─ 分頁① merchant-app.html      商家助手 = 營運(開店→接單→數據→會員→增長)
 ├─ 分頁② merchant-analytics.html 生意參謀 = 數據(總覽/行業/客戶/競對/對比)
 └─ 分頁③ user.html?store=nuan    用戶端預覽(所見即顧客所見)
```

驗收基準=Melon 的 60 秒劇本:「掃用戶版→走進暖暖窩點一單→掃商家版看訂單跳進接單看板→
切生意參謀看這單寫進經營數據」。他的原話:**「提案可以包裝,閉環不能造假。」**
講稿與逐步操作:`local-life-lab/docs/03-plans/biz-app-demo-script.md`(不可及也沒關係,AGENTS.md 的跑法+協定表足夠)。

## 二、產品決策(已拍板,不要重開)

| 決策 | 內容 | 出處 |
|---|---|---|
| 沿用 demo | 接手這三個檔迭代,不從零重寫 | Melon 0728 |
| 生意參謀 MVP 範圍 | **自店(L0/L2 級數據)+商圈聚合(L1)**;同業對比(L3)不做,分頁保留當上樓梯 | Melon 0728 |
| 對標口徑 | 「商圈前 25% 聚合均值(去識別化,不指向任何單一店家)」——取代原本的「標杆店 S」 | Robert 0728 |
| TA | 中小型連鎖商家(非單店、非大連鎖) | Melon 0727 |
| 邊界 | 不動 POS;L0=0 元 0 抽成;官方不賣貨/核銷才結算/數據紅利只回饋開通商家 | Melon 提案 0721 |
| 北極星 | 平台=週活躍商家數×單店週訂單;自營小程序=帶動商家開通數 | Melon 文件 |

生意參謀 15 個區塊的做/不做分類:`local-life-lab/docs/03-plans/biz-app-mvp-scope.md`。
速記:**頁面上的 L0/L1 標籤=要真做;L3 標籤=demo 樓梯**。

## 三、0728 已完成(這個 demo 的當前狀態)

- 19 處修復:過期開獎日 7/25→9/25(11 處)、數據頁日期 7/28(二)、參謀本週 07/20–07/26、
  「上期 6/25」→7/25(6 月不開獎,原本就錯)、跨檔數字對齊(回購 34%/均值 27%/回頭客 59-41)、
  統編統一 24567890、「標杆店」全部改「商圈前 25%」
- 全部瀏覽器實測過(HTTP 同源、console 零錯誤):登入、三分頁、參謀五分頁、
  雙向聯動(下單進看板/接單→出餐→叫號/發券進券夾 2→3)
- 已上 GitHub Pages(main push 即發佈,被另一 session 的 commit `60a5bf7` 一起帶上去的)

## 四、卡在別人手上的(不要在 demo 裡假裝解掉)

| # | 事 | 卡誰 | 對 demo 開發的意義 |
|---|---|---|---|
| 1 | ~~`INTEGRATION_API_KEY` 未生效~~(0803 覆核:dev 已不是 503,改回 401 = 伺服器 env 已生效,只是我們探針用的是 dummy key)——**還缺的只剩真 key 本身跟 shopId** | 真 key:Nero/Adam;shopId:Robert 到店 | 「自店真數據」現在只差 shopId + 真 key 就能跑,不再是 env 沒生效 |
| 2 | 暖暖窩 shopId(點到 Shop UUID)待到店取得 | Robert | 用戶端「暖暖窩」深連結還不能直達真店 |
| 3 | 店家 `enableInvoice` toggle | 暖暖窩老闆 | 關著的話載具不進點到 DB,carrier join 永遠空 |
| 4 | 商圈統編名單(發票 rawdata 沒有地理欄位,只能用 `seller_ban` 自組商圈) | 沒人盤(不卡權限) | 「商圈聚合」那半的真資料來源;demo 先用假數 |

## 五、相關 repo 地圖(真資料串接才需要)

| 路徑(Robert 機器上) | 是什麼 | 界線 |
|---|---|---|
| `Ideas/small-shop-src` | 點到原始碼(唯讀參照)。訂單 API=MR !93 `GET /api/integration/orders`(header `x-integration-key`) | 要改走他們 GitLab MR,絕不直改 |
| `Ideas/miniapps/nest-integration` | 串接工具:`verify-shop.py`(驗 shopId+enableInvoice)、`carrier-join.py`(訂單×發票 join,含時區/CANCELLED/MSYS 坑)、`e2e-record.md` | 這裡不寫產品 code |
| `Ideas/miniapps` | 三個官方自營小程序(detox/bored/wealth)+共用層 `_kit`(hash 鎖) | 共用層只能在 `_kit` 改+sync |
| `Ideas/local-life-lab` | PM 文件庫:MVP 範圍、demo 講稿、Melon 文件消化、六環 E2E 計畫 | 文件,隨意讀 |

點到環境:dev 後端 `xlab-test.cmoney.tw/Small-shop`、prod 後端 `xlab-api.cmoney.tw/Small-shop`、
客人前端 `dotdao-eat.cmoney.tw/{shopId}/order`。真店訂單只會在 prod DB(dev key 只能證明 API 會動)。

## 六、後續開發候選(按價值排,都還沒開工)

1. **參謀接真資料的縫**:給 `merchant-analytics.html` 一個資料注入點(如 `window.BIZ_DATA` 或
   `?data=` 載 JSON),讓假數與真數同一版面切換——key 一生效就能換膛,不用改版面
2. **「需求單」語彙升級**:Melon v2.0 把「券」升級為「需求單」(就醫單/補貨單/回訪券,
   只能由商家小程序承接核銷)——助手「增長」與用戶端券夾的文案與物件模型跟進
3. **埋點**:0728 每日同步 Melon 點名上線前要有「User Flow 逐步轉換率」——
   demo 已有 `track` 概念但無接收端;先定義事件表
4. **開店流程接真統編 API**(經濟部商工登記公開資料)讓 demo「統編一鍵帶入」變真的

## 七、驗收(改完必跑)

```bash
python checks/verify-demo.py   # 靜態閘門,exit 0 必須
```

手動(HTTP 起服後):登入→三分頁都開;用戶端下一單→助手看板即時出現→接單→出餐;
助手發喚回券→用戶券夾+1;參謀五分頁點過無 console error。
