# 九州冬季自駕之旅：行程網站

左邊是路線地圖，右邊是每天的行程，點任何一站都會在地圖上跳到那個位置。網站可以切換 5 天版和 6 天版，另外還有「航班與住宿」「費用推估」「行前清單」三個分頁。知道密碼的人可以直接在網頁上修改行程並儲存。

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `index.html` | 行程網站本體 |
| `setup.html` | 設定編輯密碼（只需要做一次） |
| `config.js` | 存放 repo 資訊和加密後的金鑰，由 setup.html 自動寫入 |
| `data/itinerary.json` | 所有行程資料，網站上編輯後會自動更新這個檔案 |
| `assets/` | 網站的程式和樣式 |

---

## 第一次架設（大約 15 分鐘）

### 1. 建立 GitHub 帳號
到 <https://github.com> 註冊。帳號名稱會出現在網址裡，例如帳號是 `mytrip2027`，網址就會是 `https://mytrip2027.github.io/...`。

### 2. 建立 repo
1. 登入後，按右上角的 **＋** → **New repository**。
2. **Repository name** 填一個名稱，例如 `kyushu-trip`。
3. 選 **Public**。免費帳號的 GitHub Pages 只能用公開的 repo。
4. 按 **Create repository**。

### 3. 上傳檔案
1. 在剛建好的 repo 頁面，點 **uploading an existing file**。
2. 先把下載的 zip 解壓縮，打開資料夾，**選取裡面所有的檔案和資料夾**（`index.html`、`setup.html`、`config.js`、`README.md`、`assets`、`data`），一起拖進上傳區。注意不要拖外層資料夾本身。
3. 拉到下方按 **Commit changes**。
4. 上傳完成後，repo 首頁最外層應該直接看到 `index.html`，以及 `assets`、`data` 兩個資料夾。

### 4. 開啟 GitHub Pages
1. 進入 repo 的 **Settings** → 左側選 **Pages**。
2. **Source** 選 **Deploy from a branch**。
3. **Branch** 選 `main`，資料夾選 `/ (root)`，按 **Save**。
4. 等 1–2 分鐘，頁面上方會出現網址，格式是 `https://帳號.github.io/repo名稱/`。把這個網址傳給大家，就能瀏覽行程了。

### 5. 建立 GitHub 金鑰
這把金鑰讓網站有權限把修改存回 repo，而且只能動這一個 repo。

1. 點右上角頭像 → **Settings** → 左側最下面的 **Developer settings**。
2. 選 **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
3. 填寫以下欄位：
   - **Token name**：隨便取，例如 `kyushu-trip-editor`。
   - **Expiration**：選到旅程結束之後，例如自訂為 2027/02/28。
   - **Repository access**：選 **Only select repositories**，然後只勾這個行程 repo。
   - **Permissions** → **Repository permissions** → **Contents** 改成 **Read and write**，其他權限都不用動。
4. 按 **Generate token**，複製以 `github_pat_` 開頭的金鑰。這串金鑰只會顯示這一次，請先貼在安全的地方。

### 6. 設定編輯密碼
1. 打開 `https://帳號.github.io/repo名稱/setup.html`。
2. 依序填入 GitHub 帳號名稱、repo 名稱、剛剛複製的金鑰，以及你想設定的編輯密碼。密碼至少 10 個字，建議用一句話，例如「我們一月要去九州吃牛腸鍋」。
3. 按 **驗證並寫入設定**。看到「設定完成」就代表好了。
4. 大約 1 分鐘後回到行程網站，按 **編輯行程**，輸入密碼就能開始修改。

---

## 怎麼編輯

1. 按右上角 **編輯行程**，輸入密碼。
2. 可以做的事：
   - 直接修改時間、名稱、備註和類型。
   - 拖曳每一站左邊的 **⋮⋮** 調整順序，也可以拖到別天。
   - 按 **設定位置** 搜尋地點。日文名稱最容易搜到，也可以改用 **改用點地圖**，直接在地圖上點一下。
   - 新增或刪除一站、新增或刪除一天，也可以修改每天的交通方式。選「自駕」會畫出沿道路的路線，選「大眾運輸」會畫虛線。
   - 「航班與住宿」「費用推估」「行前清單」三個分頁在編輯模式下也都能改。
3. 改完按 **儲存到 GitHub**。大約 1 分鐘後，大家重新整理網頁就會看到新版本。
4. 如果剛好有兩個人同時編輯，後存的人會看到提醒。這時先按 **下載備份** 把修改存起來，重新整理頁面後再改一次即可。

### 更換密碼或金鑰過期
重新執行一次第 5、6 步就好：建立新金鑰，打開 `setup.html` 設定新密碼。舊密碼會立刻失效。

---

## 安全性說明

- 金鑰是用你的密碼加密之後才存進 `config.js`。repo 是公開的，所以任何人都看得到加密後的內容，但沒有密碼就解不開，也就改不了行程。
- 加密的強度取決於密碼長度，**請不要用生日、電話這類短密碼**。
- 金鑰的權限只限這一個 repo 的檔案內容，就算外洩，也動不到你帳號裡的其他東西。
- 如果懷疑密碼外洩，到 GitHub 的 Fine-grained tokens 頁面把那把金鑰刪掉，再重新設定即可。
- 網站是公開的，請不要放訂位代號、護照號碼這類個人資料。

## 需要你確認的地圖位置

以下幾個點的座標是估計值，請進入編輯模式，用「設定位置」修正：

- FAV KUMAMOTO
- ライコランド福岡空港店
- 与羅ん館

## 技術說明

- 地圖使用 [Leaflet](https://leafletjs.com/) 和 [OpenStreetMap](https://www.openstreetmap.org/)，不需要申請 API 金鑰，也不會產生費用。
- 自駕路線是由 OSRM 公共路線服務計算的。服務偶爾忙碌時，路線會暫時顯示成虛線，重新整理即可。
- 地點搜尋使用 OpenStreetMap 的 Nominatim 服務。
