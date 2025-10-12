import "dotenv/config";
import { Browser } from "@/core/Browser";
import { Page } from "puppeteer";
import { getRestaurantIds } from "@/utils/restaurants";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { findOrderByCarrierOrderId, updateOrderDispute } from "@/utils/order_processing";
import { loadAuthCache, saveAuthCache } from "@/utils/auth_cache";

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

async function extractAuthData(page: Page) {
  console.log('\nExtracting authentication data...');

  // Get all cookies
  const cookies = await page.cookies();

  // Extract specific cookies we need (sid can be on either .uber.com or .ubereats.com)
  const sid = cookies.find(c => c.name === 'sid' && (c.domain === '.uber.com' || c.domain === '.ubereats.com'))?.value;
  const jwtSession = cookies.find(c => c.name === 'jwt-session')?.value;
  const jwtSessionUem = cookies.find(c => c.name === 'jwt-session-uem')?.value;
  const cfClearance = cookies.find(c => c.name === 'cf_clearance')?.value;
  const selectedRestaurant = cookies.find(c => c.name === 'selectedRestaurant')?.value;
  const udiId = cookies.find(c => c.name === 'udi-id')?.value;
  const udiFingerprint = cookies.find(c => c.name === 'udi-fingerprint')?.value;

  // Get CSRF token from page or request headers
  const csrfToken = await page.evaluate(() => {
    // Try to find CSRF token in meta tags
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
      return metaTag.getAttribute('content');
    }
    // Try to find in window object
    return (window as any).csrfToken || null;
  });

  const authData = {
    sid,
    jwtSession,
    jwtSessionUem,
    cfClearance,
    selectedRestaurant,
    udiId,
    udiFingerprint,
    csrfToken: csrfToken || 'x', // Default to 'x' if not found
  };

  console.log('\n📋 Authentication Data:');
  console.log(JSON.stringify(authData, null, 2));

  // Also print all cookies as a single cookie string for easy copy-paste
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log('\n📋 All Cookies String:');
  console.log(cookieString);

  return authData;
}

async function fetchOrdersPage(
  authData: any,
  restaurantUUID: string,
  startDate: string,
  endDate: string,
  cursor?: string
) {
  const pagination: any = {
    limit: 20,
    nextTable: cursor ? "historyOrders" : "liveOrders"
  };

  if (cursor) {
    pagination.cursor = cursor;
  }

  const response = await fetch('https://merchants.ubereats.com/manager/graphql', {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      'origin': 'https://merchants.ubereats.com',
      'referer': `https://merchants.ubereats.com/manager/orders?restaurantUUID=${restaurantUUID}&orderIssuesV2=ORDER_ACCURACY_ISSUE%2CMISSING_CUSTOMIZATIONS%2CWRONG_CUSTOMIZATIONS%2CMISSING_ITEMS%2CWRONG_ORDER%2CWRONG_ITEMS%2CORDER_WITH_FTQ%2CTASTE_QUALITY_ISSUES`,
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'x-csrf-token': authData.csrfToken,
      'Cookie': `sid=${authData.sid}; jwt-session=${authData.jwtSession}; jwt-session-uem=${authData.jwtSessionUem}; cf_clearance=${authData.cfClearance}; selectedRestaurant=${authData.selectedRestaurant}; udi-id=${authData.udiId}; udi-fingerprint=${authData.udiFingerprint}`,
    },
    body: JSON.stringify({
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
            locationUUIDs: [restaurantUUID]
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

  return await response.json();
}

async function fetchOrders(authData: any, restaurantUUID: string) {
  console.log('\nFetching orders with pagination...');

  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  console.log(`Date range: ${startDate} to ${endDate}`);

  let allOrders: any[] = [];
  let cursor: string | undefined = undefined;
  let pageNumber = 1;

  do {
    console.log(`\n  Fetching page ${pageNumber}${cursor ? ` (cursor: ${cursor})` : ''}...`);

    const data = await fetchOrdersPage(authData, restaurantUUID, startDate, endDate, cursor);

    const orders = data?.data?.ordersV2?.rows || [];
    allOrders = allOrders.concat(orders);

    console.log(`  ✓ Fetched ${orders.length} orders (total: ${allOrders.length})`);

    // Check for next page
    cursor = data?.data?.ordersV2?.paginationResult?.nextCursor;

    pageNumber++;

    // Small delay between requests to avoid rate limiting
    if (cursor) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } while (cursor);

  console.log(`\n✓ Completed fetching all pages: ${allOrders.length} total orders`);

  // Save all orders to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `orders_${restaurantUUID}_${timestamp}.json`;
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

  // If no valid cache, perform login
  if (!authData) {
    const browser = new Browser();

    try {
      console.log("Launching browser...");
      await browser.launch(false); // Debug mode - show browser

      const page = await browser.newPage();

      console.log("Navigating to UberEats merchants page...");

      await page.goto("https://merchants.ubereats.com/", {
        waitUntil: "networkidle2",
      });

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

      await login(browser, page);

      // Extract authentication data
      authData = await extractAuthData(page);

      // Save auth to cache
      saveAuthCache(authData);

      await browser.close();
      console.log("Browser closed.");
    } catch (error) {
      console.error("Error during login:", error);
      await browser.close();
      throw error;
    }
  }

  // Continue with order fetching using cached or fresh auth
  try {
    const restaurantIds = await getRestaurantIds();

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const restaurantId of restaurantIds) {
      const orders = await fetchOrders(authData, restaurantId);

      console.log(`\n\n🔄 Processing ${orders.length} orders for restaurant ${restaurantId}...\n`);

      for (const order of orders) {
        try {
          console.log(`  Processing order ${order.orderId} (${order.restaurant.name})...`);

          // Find order in database
          const dbOrder = await findOrderByCarrierOrderId(order.orderId);

          if (!dbOrder) {
            console.log(`    ⚠️  Order not found in database, skipping`);
            totalSkipped++;
            continue;
          }

          // Determine if dispute was accepted
          const disputeAccepted = order.orderTag === 'DISPUTE_ACCEPTED';

          // Update order
          await updateOrderDispute(order.orderId, disputeAccepted);

          console.log(`    ✓ Updated: disputed=true, dispute_accepted=${disputeAccepted}`);
          totalProcessed++;

        } catch (error) {
          console.error(`    ✗ Error processing order ${order.orderId}:`, error);
          totalErrors++;
        }
      }
    }

    console.log('\n\n=== Processing Summary ===');
    console.log(`Processed: ${totalProcessed}`);
    console.log(`Skipped: ${totalSkipped}`);
    console.log(`Errors: ${totalErrors}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
