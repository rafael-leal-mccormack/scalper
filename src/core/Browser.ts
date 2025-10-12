import puppeteer, { Browser as PuppeteerBrowser, Page } from 'puppeteer';

export class Browser {
  private browser: PuppeteerBrowser | null = null;

  async launch(headless: boolean = false): Promise<void> {
    this.browser = await puppeteer.launch({
      headless,
      defaultViewport: { width: 1920, height: 1080 },
    });
  }

  async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return await this.browser.newPage();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
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
