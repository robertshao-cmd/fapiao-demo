發票載具 DEMO 部署包 v6.0 / v4.1（2026-07-17）
=================================================

本次變更
1) user.html／user-nopay.html → v6.0「漫畫風」
   - 兩款官方自營遊戲整套視覺改為漫畫風：
     粗墨線描邊面板＋硬陰影（comic panel）、半調網點與
     放射爆炸線背景、白邊描邊大數字（POP 風）、黃底貼紙
     徽章、對話框吐槽（帶尾巴）、漫畫按壓手感按鈕
   - 互動色彩全面加飽和：紅 #E4001A × 黃 #FFD34D × 綠 #128A52
   - 功能與流程零改動（84 項自動化測試全過）
2) 商家端全系列 → 右上角「•••｜◉」膠囊（與用戶端一致）
   - merchant.html 商家工作台 v4.1：••• 開啟選單＝
     ↻ 重新整理（只重載當前分頁）／💬 分享到 LINE／🔗 複製連結
     ◉＝登出回主帳號登入頁；「登出」鈕整合進膠囊
   - merchant-app.html 商家助手 v3.5：獨立開啟時同樣有膠囊
     （◉＝回 Demo 入口）；嵌在工作台內自動隱藏，不重複
   - merchant-analytics.html 生意參謀 v1.2：同上
3) index.html：版本說明更新

上傳方式
1. GitHub repo：chinwei0127-abc/fapiao-test（main 分支）
2. Add file → Upload files，六個檔案拖入「覆蓋」：
   index.html / user.html / user-nopay.html /
   merchant.html / merchant-app.html / merchant-analytics.html
3. Commit 到 main，等 GitHub Pages 重新發佈（約 1–3 分鐘）
4. 一律使用「新的三張 QR」（?v=6.0／?v=4.1）掃碼驗收，
   舊參數會吃到快取

驗收路徑
- 用戶端 QR → 首頁功能架「🧪 中毒快篩」「🐣 呷健康隊」：
  應看到漫畫風畫面（墨線面板、爆炸線、貼紙徽章）
- 商家工作台 QR → 一鍵登入 → 右上「•••」：三個功能都能用；
  「重新整理」只重載當前分頁；◉ 登出回登入頁
