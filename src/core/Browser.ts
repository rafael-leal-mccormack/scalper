import puppeteer, { Browser as PuppeteerBrowser, Page } from 'puppeteer';

export class Browser {
  private browser: PuppeteerBrowser | null = null;
  private isConnected: boolean = false;

  async launch(headless: boolean = false): Promise<void> {
    this.browser = await puppeteer.launch({
      headless,
      defaultViewport: { width: 1920, height: 1080 },
    });
    this.isConnected = false;
  }

  async connect(port: number = 9222): Promise<void> {
    const browserURL = `http://localhost:${port}`;
    this.browser = await puppeteer.connect({ browserURL });
    this.isConnected = true;
  }

  async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not connected. Call connect() or launch() first.');
    }
    return await this.browser.newPage();
  }

  async pages(): Promise<Page[]> {
    if (!this.browser) {
      throw new Error('Browser not connected. Call connect() or launch() first.');
    }
    return await this.browser.pages();
  }

  async close(): Promise<void> {
    if (this.browser) {
      if (this.isConnected) {
        // Disconnect from browser without closing it
        await this.browser.disconnect();
      } else {
        // Close the browser we launched
        await this.browser.close();
      }
      this.browser = null;
      this.isConnected = false;
    }
  }

  async screenshot(page: Page, path: `${string}.png` | `${string}.jpeg` | `${string}.webp`): Promise<void> {
    await page.screenshot({ path });
  }

  async waitForSelector(page: Page, selector: string, timeout: number = 30000): Promise<void> {
    await page.waitForSelector(selector, { timeout });
  }

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
