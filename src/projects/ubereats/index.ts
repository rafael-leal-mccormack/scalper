import "dotenv/config";
import { Browser } from "@/core/Browser";
import { Page } from "puppeteer";
import { getUberEatsRestaurantIds } from "@/utils/restaurants";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { findOrderByCarrierOrderId, updateOrderDispute, insertOrdersBulk } from "@/utils/order_processing";
import { loadAuthCache, saveAuthCache } from "@/utils/auth_cache";
import { spawn, ChildProcess } from "child_process";

async function isChromeRunning(port: number = 9222): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/json/version`, {
      signal: AbortSignal.timeout(1000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function launchChrome(port: number = 9222): Promise<ChildProcess> {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = join(process.cwd(), '.chrome-profile');

  // Create user data directory if it doesn't exist
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true });
  }

  console.log('🚀 Launching Chrome with debugging enabled...');

  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=ProfilePicker'
  ], {
    detached: true,
    stdio: 'ignore'
  });

  // Wait for Chrome to be ready by checking if debugging port is accessible
  console.log('⏳ Waiting for Chrome to be ready...');
  let attempts = 0;
  const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds max

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const isReady = await isChromeRunning(port);
    if (isReady) {
      console.log('✓ Chrome debugging port is ready');
      return chromeProcess;
    }
    attempts++;
  }

  throw new Error('Chrome failed to start debugging port after 10 seconds');
}

async function login(browser: Browser, page: Page) {
  const username = process.env.USERNAME;

  if (!username) {
    throw new Error("USERNAME must be set in .env file");
  }

  // Enter username/email
  await page.click("#PHONE_NUMBER_or_EMAIL_ADDRESS");
  await page.type("#PHONE_NUMBER_or_EMAIL_ADDRESS", username);

  await page.click("#forward-button");

  console.log(
    "\n⏸️  Email entered. Please check your email for the verification code."
  );
  console.log(
    "Enter the code in the browser, then the script will continue...\n"
  );

  // Wait for user to manually enter the verification code and proceed
  // The script will wait until navigation happens (when user submits the code)
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120000 }); // 2 min timeout

  console.log("✓ Login complete!");
}

async function extractAuthData(page: Page, restaurantUUID?: string) {
  console.log('\nWaiting for GraphQL request to capture auth data...');

  // Enable request interception
  await page.setRequestInterception(true);

  // Set up request interception to capture the GraphQL request
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for GraphQL request'));
    }, 30000); // 30 second timeout

    let captured = false;

    page.on('request', (request) => {
      const url = request.url();

      // Look for the ordersV2 GraphQL request
      if (url.includes('/manager/graphql') && !captured) {
        const postData = request.postData();

        // Make sure it's the ordersV2 query we want
        if (postData && postData.includes('ordersV2')) {
          captured = true;
          const headers = request.headers();

          // Extract cookies and CSRF token from the request headers
          const cookieHeader = headers['cookie'] || '';
          const csrfToken = headers['x-csrf-token'] || 'x';

          // Parse cookies into an object
          const cookies: Record<string, string> = {};
          if (cookieHeader) {
            cookieHeader.split(';').forEach(cookie => {
              const [name, ...valueParts] = cookie.trim().split('=');
              if (name) {
                cookies[name] = valueParts.join('=');
              }
            });
          }

          const authData = {
            csrfToken,
            cookies,
            headers: {
              'accept': headers['accept'] || '*/*',
              'accept-language': headers['accept-language'] || 'en-US,en;q=0.9',
              'content-type': headers['content-type'] || 'application/json',
              'origin': headers['origin'] || 'https://merchants.ubereats.com',
              'referer': headers['referer'] || 'https://merchants.ubereats.com/manager/orders',
              'user-agent': headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          };

          console.log('\n📋 Captured Authentication Data:');
          console.log(`CSRF Token: ${authData.csrfToken}`);
          console.log(`Total Cookies: ${Object.keys(cookies).length}`);
          console.log('✓ GraphQL request intercepted successfully');

          clearTimeout(timeout);

          // Disable request interception
          page.setRequestInterception(false).catch(() => {});

          // Remove the listener to prevent multiple captures
          page.removeAllListeners('request');

          resolve(authData);
        }
      }

      // Continue all requests
      request.continue().catch(() => {});
    });

    // Navigate to orders page with filters to trigger GraphQL request
    const ordersUrl = restaurantUUID
      ? `https://merchants.ubereats.com/manager/orders?restaurantUUID=${restaurantUUID}&orderIssuesV2=ORDER_ACCURACY_ISSUE%2CMISSING_CUSTOMIZATIONS%2CWRONG_CUSTOMIZATIONS%2CMISSING_ITEMS%2CWRONG_ORDER%2CWRONG_ITEMS%2CORDER_WITH_FTQ%2CTASTE_QUALITY_ISSUES`
      : 'https://merchants.ubereats.com/manager/orders?orderIssuesV2=ORDER_ACCURACY_ISSUE%2CMISSING_CUSTOMIZATIONS%2CWRONG_CUSTOMIZATIONS%2CMISSING_ITEMS%2CWRONG_ORDER%2CWRONG_ITEMS%2CORDER_WITH_FTQ%2CTASTE_QUALITY_ISSUES';

    console.log('Navigating to orders page to trigger GraphQL request...');
    page.goto(ordersUrl, {
      waitUntil: 'networkidle2'
    }).catch(reject);
  });
}

async function fetchOrdersPage(
  authData: any,
  restaurantUUIDs: string[],
  startDate: string,
  endDate: string,
  nextTable: "liveOrders" | "historyOrders",
  cursor?: string
) {
  const pagination: any = {
    limit: 20,
    nextTable
  };

  if (cursor) {
    pagination.cursor = cursor;
  }

  // Build cookie string from all cookies
  let cookieString: string;
  if (authData.cookies && typeof authData.cookies === 'object') {
    // New format: cookies as object
    cookieString = Object.entries(authData.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  } else {
    // Old format: individual cookie fields - need to re-authenticate
    throw new Error('Authentication cache is in old format. Please delete .cache/ubereats_auth.json and run again.');
  }

  // Use captured headers if available, otherwise use defaults
  const headers = authData.headers || {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'origin': 'https://merchants.ubereats.com',
    'referer': 'https://merchants.ubereats.com/manager/orders',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  };

  const response = await fetch('https://merchants.ubereats.com/manager/graphql', {
    method: 'POST',
    headers: {
      ...headers,
      'x-csrf-token': authData.csrfToken,
      'Cookie': cookieString,
    },
    body: JSON.stringify({
      operationName: 'ordersV2',
      query: `fragment Orders_LastMessageFragment on Orders_LastMessage {
  sender
  content
  promoAmount
  promoCurrency
  __typename
}

fragment OrdersV2_OrderV2RowFragment on Orders_OrderBreakdownRow {
  orderId
  workflowUuid
  currencyCode
  restaurant {
    uuid
    name
    countryCode
    __typename
  }
  eater {
    uuid
    name
    profileURL
    numOrders
    isEatsPassSubscriber
    subscriptionPass
    __typename
  }
  orderTag
  orderChannel
  fulfillmentType
  chargebackTotal
  salesTotal
  requestedAt
  netPayout
  lastMessage {
    ...Orders_LastMessageFragment
    __typename
  }
  canceledBy
  missedBy
  orderUuid
  possibleChargebackAmount
  possibleChargebackAmountFormatted
  chargebackProcessingTimeFormatted
  courierName
  deliveryTimeLocal
  issueType
  itemIssueType
  customizationIssueType
  showEvidenceAttachedTag
  __typename
}

query ordersV2($filters: Orders_OrdersFiltersInput!, $pagination: Orders_OrdersPaginationInput, $shouldEnableChargebackComms: Boolean, $operationMetricsUDLFlowEnabled: Boolean) {
  ordersV2(
    filters: $filters
    pagination: $pagination
    shouldEnableChargebackComms: $shouldEnableChargebackComms
    operationMetricsUDLFlowEnabled: $operationMetricsUDLFlowEnabled
  ) {
    rows {
      ...OrdersV2_OrderV2RowFragment
      __typename
    }
    lastUpdatedAtUtc
    isUserAuthorizedToDispute
    paginationResult {
      nextCursor
      nextTable
      __typename
    }
    ordersCount
    nonZeroPayoutOrdersCount
    ordersIssueCount {
      missedCount
      canceledCount
      disputeInProgressCount
      disputeAcceptedCount
      disputeRejectedCount
      issueChargedCount
      issueReportedCount
      potentialDeductionCount
      __typename
    }
    __typename
  }
}
`,
      variables: {
        filters: {
          dateRange: {
            start: startDate,
            end: endDate
          },
          orderIssues: [],
          orderIssuesV2: ["ORDER_ACCURACY_ISSUE", "MISSING_CUSTOMIZATIONS", "WRONG_CUSTOMIZATIONS", "MISSING_ITEMS", "WRONG_ORDER", "WRONG_ITEMS", "ORDER_WITH_FTQ", "TASTE_QUALITY_ISSUES"],
          orderStatusFilter: [],
          search: "",
          locationConstraints: {
            cities: [],
            countries: [],
            locationUUIDs: restaurantUUIDs
          },
          displayCurrencyCode: "USD",
          currentTab: "historyOrders"
        },
        pagination,
        shouldEnableChargebackComms: true,
        operationMetricsUDLFlowEnabled: true
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`UberEats API request failed (${response.status} ${response.statusText}): ${text}`);
  }

  return await response.json();
}

async function fetchOrdersForTable(
  authData: any,
  restaurantUUIDs: string[],
  startDate: string,
  endDate: string,
  tableName: "liveOrders" | "historyOrders"
) {
  console.log(`\n  Fetching ${tableName}...`);

  let orders: any[] = [];
  let cursor: string | undefined = undefined;
  let pageNumber = 1;

  do {
    console.log(`    Page ${pageNumber}${cursor ? ` (cursor: ${cursor})` : ''}...`);

    const data = await fetchOrdersPage(authData, restaurantUUIDs, startDate, endDate, tableName, cursor);

    const pageOrders = data?.data?.ordersV2?.rows || [];
    orders = orders.concat(pageOrders);

    console.log(`    ✓ Fetched ${pageOrders.length} orders (total: ${orders.length})`);

    // Check for next page
    cursor = data?.data?.ordersV2?.paginationResult?.nextCursor;

    pageNumber++;

    // Small delay between requests to avoid rate limiting
    if (cursor) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } while (cursor);

  console.log(`  ✓ Completed ${tableName}: ${orders.length} total orders`);

  return orders;
}

async function fetchOrders(authData: any, restaurantUUIDs: string[]) {
  console.log('\nFetching orders for all restaurants with pagination...');
  console.log(`Restaurants: ${restaurantUUIDs.join(', ')}`);

  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  console.log(`Date range: ${startDate} to ${endDate}`);

  // Fetch both live orders and history orders
  const liveOrders = await fetchOrdersForTable(authData, restaurantUUIDs, startDate, endDate, "liveOrders");
  const historyOrders = await fetchOrdersForTable(authData, restaurantUUIDs, startDate, endDate, "historyOrders");

  // Combine all orders
  const allOrders = [...liveOrders, ...historyOrders];

  console.log(`\n✓ Total orders fetched: ${allOrders.length} (${liveOrders.length} live + ${historyOrders.length} history)`);

  // Save all orders to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `orders_all_restaurants_${timestamp}.json`;
  const dataDir = join(process.cwd(), 'data');
  const filepath = join(dataDir, filename);

  try {
    // Create data directory if it doesn't exist
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(filepath, JSON.stringify({ data: { ordersV2: { rows: allOrders } } }, null, 2));
    console.log(`✓ Orders saved to: ${filepath}`);
  } catch (error) {
    console.error(`✗ Failed to save orders to file:`, error);
  }

  return allOrders;
}

async function main() {
  // Try to load cached authentication first
  let authData = loadAuthCache();

  let chromeProcess: ChildProcess | null = null;
  let weLaunchedChrome = false;

  // If no valid cache, extract from existing Chrome
  if (!authData) {
    const browser = new Browser();

    try {
      // Check if Chrome is already running with debugging
      const isRunning = await isChromeRunning(9222);

      if (!isRunning) {
        console.log("\n⚠️  Chrome not running with debugging port");
        chromeProcess = await launchChrome(9222);
        weLaunchedChrome = true;
        console.log("✓ Chrome launched successfully\n");
      } else {
        console.log("\n✓ Chrome already running with debugging enabled\n");
      }

      console.log("🔗 Connecting to Chrome instance...");
      await browser.connect(9222);

      const pages = await browser.pages();
      let page = pages.find(p => p.url().includes('ubereats.com'));

      if (!page) {
        console.log("No UberEats page found, creating new tab...");
        page = await browser.newPage();
        console.log("Navigating to UberEats merchants page...");
        await page.goto("https://merchants.ubereats.com/", {
          waitUntil: "networkidle2",
        });

        // Remove target attribute and click manager link
        console.log("Clicking manager link...");
        await page.evaluate(() => {
          const link = document.querySelector('a[href="https://merchants.ubereats.com/manager"]');
          if (link) {
            link.removeAttribute('target');
          }
        });

        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2" }),
          page.click('a[href="https://merchants.ubereats.com/manager"]'),
        ]);

        const url = page.url();
        console.log(`✓ Successfully loaded page: ${url}`);

        // Check if we're already logged in or need to log in
        const needsLogin = url.includes('auth.uber.com') || url.includes('login');

        if (needsLogin) {
          await login(browser, page);
        } else {
          console.log("✓ Already logged in!");
        }
      } else {
        console.log(`✓ Found existing UberEats tab: ${page.url()}`);
      }

      // Get restaurant mappings to use first restaurant UUID
      const restaurantMappings = await getUberEatsRestaurantIds();
      const firstRestaurantUUID = restaurantMappings[0]?.restaurantUUID;

      // Extract authentication data by intercepting GraphQL request
      // This will navigate to the orders page and capture the request
      authData = await extractAuthData(page, firstRestaurantUUID);

      // Save auth to cache
      // Ensure we have valid auth data
      if (!authData) {
        throw new Error('Failed to obtain authentication data');
      }
      saveAuthCache(authData);

      await browser.close();
      console.log("✓ Disconnected from browser.");
    } catch (error) {
      console.error("Error extracting auth:", error);
      await browser.close();

      // Clean up Chrome if we launched it
      if (weLaunchedChrome && chromeProcess) {
        console.log('🧹 Closing Chrome due to error...');
        chromeProcess.kill();
      }

      throw error;
    }
  }


  // Continue with order fetching using cached or fresh auth
  try {
    const restaurantMappings = await getUberEatsRestaurantIds();

    // Extract all restaurant UUIDs for a single API call
    const restaurantUUIDs = restaurantMappings.map(r => r.restaurantUUID);

    // Create a lookup map: restaurantUUID -> restaurantId
    const uuidToIdMap = new Map(
      restaurantMappings.map(r => [r.restaurantUUID, r.restaurantId])
    );

    // Fetch all orders in a single API call
    const orders = await fetchOrders(authData, restaurantUUIDs);

    console.log(`\n\n🔄 Processing ${orders.length} orders...\n`);

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Initialize array to collect orders to insert
    const ordersToInsert: any[] = [];

    for (const order of orders) {
      try {
        const eaterName = order.eater?.name || 'Unknown';
        console.log(`  Processing order ${order.orderId} - ${eaterName} (${order.restaurant.name})...`);

        // Get restaurant ID from UUID using the lookup map
        const restaurantId = uuidToIdMap.get(order.restaurant.uuid);
        if (!restaurantId) {
          console.log(`    ⚠️  Restaurant UUID ${order.restaurant.uuid} not found in mapping, skipping...`);
          totalSkipped++;
          continue;
        }

        // Parse order date from requestedAt field
        // Format: "10/17/2025, 11:25 PM"
        let orderDate: Date | undefined;
        if (order.requestedAt) {
          try {
            orderDate = new Date(order.requestedAt);
          } catch (e) {
            console.log(`    ⚠️  Failed to parse order date: ${order.requestedAt}`);
          }
        }

        // Find order in database using order ID, eater name, and timeframe
        const dbOrder = await findOrderByCarrierOrderId(order.orderId, eaterName, orderDate);

        if (!dbOrder) {
          console.log(`    📝 Order not found in database, will be saved...`);

          // Determine if dispute was accepted
          const disputeAccepted = order.orderTag === 'DISPUTE_ACCEPTED' || order.orderTag === 'UBER_REFUNDED';

          // Parse dispute amount - chargebackTotal can be a string like "$2.68" or number
          let disputeAmount: number | null = null;
          if (order.chargebackTotal) {
            if (typeof order.chargebackTotal === 'string') {
              disputeAmount = parseFloat(order.chargebackTotal.replace(/[$,]/g, '')) || null;
            } else {
              disputeAmount = order.chargebackTotal;
            }
          }

          // Extract items from order if available (this structure may vary)
          const orderItems = order.items || [];

          // Prepare order data for bulk insert
          const orderData = {
            carrier: 'uber_eats',
            order_number: order.orderId,
            carrier_order_id: order.orderId,
            restaurant_id: restaurantId,
            customer_name: eaterName,
            disputed: true,
            dispute_accepted: disputeAccepted,
            dispute_amount: disputeAmount,
            items: orderItems,
            created_at: orderDate ? orderDate.toISOString() : undefined
          };

          ordersToInsert.push(orderData);
          continue;
        }

        // Determine if dispute was accepted
        const disputeAccepted = order.orderTag === 'DISPUTE_ACCEPTED' || order.orderTag === 'UBER_REFUNDED';

        // Update the found order
        await updateOrderDispute(
          dbOrder.id,
          disputeAccepted,
          order.chargebackTotal
        );

        console.log(`    ✓ Updated: disputed=true, dispute_accepted=${disputeAccepted}`);
        totalProcessed++;

      } catch (error) {
        console.error(`    ✗ Error processing order ${order.orderId}:`, error);
        totalErrors++;
      }
    }

    // Bulk insert orders that weren't found in the database
    if (ordersToInsert.length > 0) {
      console.log(`\n  💾 Bulk inserting ${ordersToInsert.length} new orders...`);
      const result = await insertOrdersBulk(ordersToInsert);

      if (result.errors.length > 0) {
        console.error(`  ⚠️  ${result.errors.length} errors during bulk insert`);
        totalErrors += result.errors.length;
      }

      totalProcessed += result.inserted;
      console.log(`  ✓ Successfully inserted ${result.inserted} orders`);
    }

    console.log('\n\n=== Processing Summary ===');
    console.log(`Processed: ${totalProcessed}`);
    console.log(`Skipped: ${totalSkipped}`);
    console.log(`Errors: ${totalErrors}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Clean up: close Chrome if we launched it
    if (weLaunchedChrome && chromeProcess) {
      console.log('\n🧹 Closing Chrome...');
      chromeProcess.kill();
      console.log('✓ Chrome closed');
    }
  }
}

main();
