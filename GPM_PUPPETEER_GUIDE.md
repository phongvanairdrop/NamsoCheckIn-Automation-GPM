# GPM + Puppeteer Automation Guide

*Kinh nghiệm thực tế từ dự án DePIN Monitor*

---

## 1. Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Node.js App                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────│
│  │ MonitorService│──────│ExtensionMonitor│───│ReloginHandler│
│  └──────────────┘      └──────────────┘      └──────────────│
│         │                      │                            │
│         ▼                      ▼                            │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │  GPMClient   │──────│ Puppeteer CDP│                     │
│  └──────────────┘      └──────────────┘                     │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         GPM (http://127.0.0.1:19995)                 │   │
│  │  - Start/Stop profiles                               │   │
│  │  - Get debug address for Puppeteer connection        │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Chrome Profile (Headful)                │   │
│  │         Running with Extensions Installed            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. GPM API Essentials

### Endpoint quan trọng

```javascript
const GPM_API = 'http://127.0.0.1:19995';

// Lấy danh sách profiles
GET /api/v3/profiles

// Lấy thông tin 1 profile
GET /api/v3/profile/{profileId}

// Start profile - TRẢ VỀ DEBUG ADDRESS
GET /api/v3/profiles/start/{profileId}

// Stop profile
GET /api/v3/profiles/close/{profileId}
```

### Response khi start profile (QUAN TRỌNG!)

```json
{
  "success": true,
  "data": {
    "profile_id": "xxx-xxx-xxx",
    "browser_location": "C:\\Users\\...\\Profile 1",
    "remote_debugging_address": "127.0.0.1:9222",  // ← LẤY CÁI NÀY!
    "driver_path": "C:\\Users\\...\\chromedriver.exe"
  }
}
```

**`remote_debugging_address`** là key để Puppeteer kết nối lại sau này!

---

## 3. Puppeteer + GPM Connection Pattern

### 3.1. Connect từ debug address

```typescript
import puppeteer from 'puppeteer';

async function connectToGPMProfile(debugAddress: string) {
  // Cách 1: Dùng puppeteer.connect()
  const browser = await puppeteer.connect({
    browserWSEndpoint: `ws://${debugAddress}/devtools/browser/xxx`
  });

  // Cách 2: Dùng CDP trực tiếp (flexible hơn)
  const browser = await puppeteer.connect({
    browserURL: `http://${debugAddress}`
  });

  return browser;
}
```

### 3.2. Flow chuẩn cho automation

```typescript
class ProfileAutomation {
  private browser?: Browser;
  private debugAddress?: string;

  // BƯỚC 1: Start profile qua GPM
  async start(profileId: string) {
    const response = await fetch(`${GPM_API}/api/v3/profiles/start/${profileId}`);
    const data = await response.json();

    // LƯU DEBUG ADDRESS - QUAN TRỌNG!
    this.debugAddress = data.data.remote_debugging_address;

    // Connect Puppeteer
    this.browser = await puppeteer.connect({
      browserURL: `http://${this.debugAddress}`
    });
  }

  // BƯỚC 2: Làm việc với extension
  async checkExtension(extensionUrl: string) {
    if (!this.browser) throw new Error('Not connected');

    const pages = await this.browser.pages();

    // Tìm tab của extension hoặc mở mới
    let page = pages.find(p => p.url().includes(extensionUrl));
    if (!page) {
      page = await this.browser.newPage();
      await page.goto(extensionUrl);
    }

    await page.bringToFront();

    // Wait để extension load xong
    await new Promise(r => setTimeout(r, 3000));

    // Lấy nội dung
    const content = await page.evaluate(() => document.body?.innerText || '');
    return content;
  }

  // BƯỚC 3: Minimize để tiết kiệm tài nguyên
  async minimize() {
    if (!this.browser) return;

    const pages = await this.browser.pages();
    if (pages.length > 0) {
      const client = await pages[0].target().createCDPSession();

      // Get windowId
      const target = await client.send('Browser.getWindowForTarget');

      // Minimize qua CDP
      await client.send('Browser.setWindowBounds', {
        windowId: target.windowId,
        bounds: { windowState: 'minimized' }
      });
    }
  }

  // BƯỚC 4: Disconnect (browser vẫn chạy)
  async disconnect() {
    if (this.browser) {
      await this.browser.disconnect();
      this.browser = undefined;
    }
    // debugAddress vẫn được giữ để reconnect sau
  }

  // BƯỚC 5: Reconnect (cho scheduler/check định kỳ)
  async reconnect() {
    if (!this.debugAddress) {
      throw new Error('No debug address saved');
    }

    this.browser = await puppeteer.connect({
      browserURL: `http://${this.debugAddress}`
    });
  }
}
```

---

## 4. Extension Detection Pattern

### 4.1. Config structure cho extension

```typescript
interface ExtensionConfig {
  name: string;
  extensionId: string;
  popupUrl: string;

  // Detection rules
  detection: {
    loggedIn: {
      urlContains?: string | string[];
      textContains?: string | string[];
    };
    loggedOut: {
      urlContains?: string | string[];
      textContains?: string | string[];
    };
  };

  // Metrics extraction (regex)
  metrics: {
    points?: { regex: string };
    status?: { regex: string };
    uptime?: { regex: string };
    daily?: { regex: string };
  };

  // Action khi logged_out
  action: 'notify_only' | 'toggle_connect' | 'form_relogin' | 'full_relogin' | 'points_only';
}
```

### 4.2. Detection logic

```typescript
function detectStatus(page: Page, config: ExtensionConfig): 'logged_in' | 'logged_out' {
  const url = page.url();
  const bodyText = await page.evaluate(() => document.body?.innerText || '');

  const { loggedIn, loggedOut } = config.detection;

  // Check logged_out first (priority)
  if (checkCondition(url, bodyText, loggedOut)) {
    return 'logged_out';
  }

  // Then check logged_in
  if (checkCondition(url, bodyText, loggedIn)) {
    return 'logged_in';
  }

  // Default: assume logged_out
  return 'logged_out';
}

function checkCondition(url: string, text: string, condition: any): boolean {
  // Check URL
  if (condition.urlContains) {
    const targets = Array.isArray(condition.urlContains)
      ? condition.urlContains
      : [condition.urlContains];

    if (!targets.some(t => url.includes(t))) return false;
  }

  // Check text content
  if (condition.textContains) {
    const targets = Array.isArray(condition.textContains)
      ? condition.textContains
      : [condition.textContains];

    if (!targets.some(t => text.includes(t))) return false;
  }

  return true;
}
```

---

## 5. Relogin Strategies

### 5.1. Toggle connect (BrowserCash)

```typescript
async reloginBrowserCash(page: Page) {
  // Click element để toggle connect status
  await page.evaluate(() => {
    const statusEl = document.querySelector('#connection-status');
    if (statusEl) (statusEl as HTMLElement).click();
  });
  await new Promise(r => setTimeout(r, 2000)); // Wait for toggle
}
```

### 5.2. Form relogin (NamsoValidator)

```typescript
async reloginForm(page: Page, email: string, password: string) {
  await page.type('#email', email);
  await page.type('#password', password);
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3000));
}
```

### 5.3. Full relogin with navigation (OptimAI)

```typescript
async fullRelogin(page: Page, email: string, password: string) {
  // Navigate to login page
  await page.goto('chrome-extension://xxx/popup/index.html');

  // Wait để DOM render
  await new Promise(r => setTimeout(r, 3000));

  // Find and click login button
  const loginBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(b => b.textContent?.includes('Log In'));
  });

  if (loginBtn) {
    await loginBtn.click();
    await new Promise(r => setTimeout(r, 2000));

    // Fill form
    await page.type('input[name="email"]', email);
    await page.type('input[name="password"]', password);
    await page.click('button[type="submit"]');
  }
}
```

---

## 6. Window Management với CDP

### 6.1. Minimize window

```typescript
async minimizeWindow(page: Page) {
  const client = await page.target().createCDPSession();

  const target = await client.send('Browser.getWindowForTarget');

  await client.send('Browser.setWindowBounds', {
    windowId: target.windowId,
    bounds: { windowState: 'minimized' }
  });
}
```

### 6.2. Restore window

```typescript
async restoreWindow(page: Page) {
  const client = await page.target().createCDPSession();

  const target = await client.send('Browser.getWindowForTarget');

  await client.send('Browser.setWindowBounds', {
    windowId: target.windowId,
    bounds: { windowState: 'normal' }
  });
}
```

### 6.3. Grid layout cho nhiều windows

```typescript
async arrangeWindowsGrid(browser, position: number, total: number) {
  const screen = { width: 1920, height: 1080 };
  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);

  const windowWidth = Math.floor(screen.width / cols);
  const windowHeight = Math.floor(screen.height / rows);

  const col = position % cols;
  const row = Math.floor(position / cols);
  const posX = col * windowWidth;
  const posY = row * windowHeight;

  const pages = await browser.pages();
  for (const page of pages) {
    await page.evaluate((w, h, x, y) => {
      window.resizeTo(w, h);
      window.moveTo(x, y);
    }, windowWidth - 50, windowHeight - 50, posX, posY);
  }
}
```

---

## 7. Scheduler Pattern

```typescript
class Scheduler {
  private timer?: NodeJS.Timeout;
  private interval: number = 30; // minutes

  start(callback: () => Promise<void>) {
    this.stop();
    this.schedule(callback);
  }

  private schedule(callback: () => Promise<void>) {
    const ms = this.interval * 60 * 1000;

    this.timer = setTimeout(async () => {
      console.log(`[Scheduler] Running at ${new Date().toLocaleTimeString()}`);

      try {
        await callback();
      } catch (error) {
        console.error('[Scheduler] Error:', error);
      }

      // Reschedule next run
      this.schedule(callback);
    }, ms);
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  setInterval(minutes: number) {
    this.interval = minutes;
    // Restart with new interval
    this.start(this.currentCallback);
  }
}
```

---

## 8. Gotchas & Best Practices

### 8.1. LUÔN N LƯU debug address!

```typescript
// ❌ SAI
async startProfile(profileId: string) {
  const browser = await puppeteer.connect({...});
  // làm việc...
  await browser.disconnect();
  // MẤT debug address - không thể reconnect!
}

// ✅ ĐÚNG
class ProfileManager {
  private debugAddresses = new Map<string, string>();

  async startProfile(profileId: string) {
    const response = await fetch(`${GPM_API}/profiles/start/${profileId}`);
    const data = await response.json();

    // LƯU DEBUG ADDRESS
    this.debugAddresses.set(profileId, data.data.remote_debugging_address);

    const browser = await puppeteer.connect({
      browserURL: `http://${data.data.remote_debugging_address}`
    });

    // làm việc...
    await browser.disconnect();
    // debugAddress vẫn được lưu - có thể reconnect!
  }
}
```

### 8.2. Wait đủ lâu cho extension load

```typescript
// ❌ SAI
await page.goto(extensionUrl);
const content = await page.evaluate(() => document.body.innerText);

// ✅ ĐÚNG
await page.goto(extensionUrl, { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000)); // Extension cần thời gian load
const content = await page.evaluate(() => document.body?.innerText || '');
```

### 8.3. Handle Shadow DOM

```typescript
// Nhiều extension dùng Shadow DOM
async getShadowText(page: Page, selector: string) {
  return await page.evaluate((sel) => {
    const host = document.querySelector(sel);
    if (!host?.shadowRoot) return '';

    return host.shadowRoot.innerText || '';
  }, selector);
}
```

### 8.4. Graceful shutdown

```typescript
process.on('SIGINT', async () => {
  console.log('\n[App] Shutting down gracefully...');

  // Disconnect all browsers
  for (const [profileId, browser] of browsers) {
    try {
      await browser.disconnect();
      console.log(`[App] Disconnected: ${profileId}`);
    } catch {}
  }

  process.exit(0);
});
```

---

## 9. Telegram Notification Pattern

```typescript
import TelegramBot from 'node-telegram-bot-api';

class TelegramNotifier {
  private bot: TelegramBot;

  constructor(botToken: string, private chatId: string) {
    this.bot = new TelegramBot(botToken, { polling: false });
  }

  async sendAlert(profileName: string, extension: string, issue: string) {
    const message = `⚠️ *Alert*\n\n*Profile:* ${profileName}\n*Extension:* ${extension}\n*Issue:* ${issue}`;

    await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
  }

  async sendReport(results: ProfileResult[]) {
    let message = `📊 *Report*\n⏰ ${new Date().toLocaleString('vi-VN')}\n\n`;

    for (const profile of results) {
      message += `*${profile.profileName}*\n`;
      for (const ext of profile.extensions) {
        const icon = ext.status === 'logged_in' ? '✅' : '❌';
        message += `${icon} ${ext.extension}: ${ext.points || 'N/A'}\n`;
      }
    }

    await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
  }
}
```

---

## 10. Environment Variables Template

```env
# .env
GPM_API_URL=http://127.0.0.1:19995
CREDENTIALS_FILE=./config/credentials.xlsx

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Scheduler
CHECK_INTERVAL_MINUTES=30

# Concurrency (parallel processing)
MAX_CONCURRENT_PROFILES=3
```

---

## 11. Debug Tips

```typescript
// 1. Log connection status
console.log(`[Profile ${id}] Connected: ${browser?.connected()}`);
console.log(`[Profile ${id}] Debug address: ${this.debugAddress}`);

// 2. Check page count
const pages = await browser.pages();
console.log(`[Profile ${id}] Pages: ${pages.length}, URLs:`, pages.map(p => p.url()));

// 3. Take screenshot on error
try {
  await doSomething();
} catch (error) {
  await page.screenshot({ path: `error-${Date.now()}.png` });
  throw error;
}

// 4. CDP version check
const version = await page.target().createCDPSession();
await version.send('Browser.getVersion');
```

---

## 12. File Structure Recommendation

```
project/
├── config/
│   ├── extensions.ts       # Extension configs
│   └── credentials.xlsx    # Profile credentials
├── src/
│   ├── core/
│   │   ├── gpm-client.ts       # GPM API wrapper
│   │   ├── extension-monitor.ts # Extension checking
│   │   └── relogin-handler.ts   # Relogin logic
│   ├── notifiers/
│   │   └── telegram.ts          # Telegram notifications
│   ├── utils/
│   │   └── excel-reader.ts      # Excel parser
│   └── server/
│       └── index.ts             # Main entry point
├── .env                        # Environment variables
└── package.json
```

---

## Quick Checklist

- [ ] GPM đang chạy (port 19995)
- [ ] Lưu `remote_debugging_address` sau khi start
- [ ] Reconnect bằng saved debug address cho scheduler
- [ ] Wait 3-5s cho extension load xong
- [ ] Minimize qua CDP khi done
- [ ] Disconnect Puppeteer (browser vẫn chạy)
- [ ] Telegram notify cho critical errors
- [ ] Graceful shutdown handling

---

*Document version: 1.0*
*Last updated: 2025-01-03*
