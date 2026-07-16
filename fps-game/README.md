# 暗影突擊 · Shadow Strike

一款**第一人稱 3D 射擊（FPS）安卓遊戲**，具備**人機對戰（AI 機器人）**、精美的 WebGL 畫面與完整的手機觸控操作。使用 [Three.js](https://threejs.org/) 開發 3D 引擎，透過 [Capacitor](https://capacitorjs.com/) 打包為原生 Android APK。

> 直接安裝：下載 [`dist/ShadowStrike-debug.apk`](dist/ShadowStrike-debug.apk)，傳到 Android 手機後點擊安裝（需開啟「允許安裝未知來源應用程式」）。

---

## 遊戲特色

- **精美 3D 場景**：即時陰影、霧氣縱深、霓虹描邊掩體、星空天球、動態點光源。
- **人機對戰 AI**：敵方機器人具備狀態機（巡邏 → 追擊 → 交火走位），會利用掩體、側移閃避、預判開火，難度隨波次提升。
- **完整戰鬥系統**：命中判定（含爆頭 2.2 倍傷害）、後座力、槍口火光、彈道曳光、彈著粒子、換彈、彈藥管理。
- **波次生存模式**：每波敵人數量遞增，清空一波回復生命並補充彈藥。
- **三種難度**：簡單 / 普通 / 困難，影響敵人血量、命中率、移動與攻擊頻率。
- **雙平台操作**：
  - 電腦：`WASD` 移動、滑鼠瞄準、左鍵射擊、`R` 換彈、空白鍵跳躍、`Shift` 衝刺。
  - 手機：左側虛擬搖桿移動、右側滑動瞄準、觸控按鈕開火／換彈／跳躍。
- **即時合成音效**：以 Web Audio API 產生槍聲、命中、換彈等音效，無需外部音檔，完全離線可用。
- **HUD**：生命條、彈藥、擊殺數、分數、波次、擊殺回饋、準星、命中標記、受傷紅屏。

---

## 專案結構

```
fps-game/
├── www/                    # 網頁遊戲本體（會被打包進 APK）
│   ├── index.html          # 版面與 HUD / 選單
│   ├── css/style.css       # 介面樣式
│   ├── lib/three.min.js    # Three.js（本地打包，離線可用）
│   └── js/
│       ├── utils.js        # 工具函式
│       ├── audio.js        # Web Audio 音效引擎
│       ├── input.js        # 鍵盤 / 滑鼠 / 觸控輸入
│       ├── world.js        # 競技場、燈光、碰撞、視線判定
│       ├── weapon.js       # 武器、射擊、特效、第一人稱槍模型
│       ├── bot.js          # 敵方 AI 機器人
│       └── game.js         # 主迴圈、波次、狀態機、UI
├── android/                # Capacitor 產生的原生 Android 專案
├── dist/ShadowStrike-debug.apk   # 已建置好的可安裝 APK
├── capacitor.config.json
└── package.json
```

---

## 在電腦瀏覽器試玩

```bash
cd fps-game/www
python3 -m http.server 8080
# 開啟瀏覽器前往 http://localhost:8080
```

## 從原始碼重新建置 APK

需求：Node.js 18+、JDK 17+、Android SDK（platform-tools、platforms;android-34、build-tools;34.0.0）。

```bash
cd fps-game
npm install

# 設定 Android SDK 路徑
export ANDROID_HOME=$HOME/android-sdk

# 將 www 同步進原生專案並建置 Debug APK
npx cap sync android
cd android
./gradlew assembleDebug

# 產物位置：
# android/app/build/outputs/apk/debug/app-debug.apk
```

### 應用資訊

| 項目 | 值 |
| --- | --- |
| App ID | `com.shadowstrike.fps` |
| 名稱 | 暗影突擊 |
| minSdk | 22 (Android 5.1+) |
| targetSdk | 34 (Android 14) |

---

## 技術說明

- 3D 引擎為 Three.js（r128 UMD 版本，本地打包），採 `MeshStandardMaterial` PBR 材質、`PCFSoftShadowMap` 柔和陰影。
- 碰撞使用 XZ 平面「圓對 AABB」解算；AI 視線與子彈遮蔽使用射線步進偵測掩體。
- 命中判定為 hitscan：以相機中心射線對敵人身體 / 頭部球體求交，再確認未被掩體遮擋。
- 全程無外部網路資源，APK 可完全離線執行。

以 Debug 簽章建置，僅供測試與試玩；若要上架商店請自行以正式金鑰簽署 Release 版本。
