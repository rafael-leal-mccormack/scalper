import "dotenv/config";
import { Browser } from "@/core/Browser";
import { Page } from "puppeteer";
import { getDoorDashRestaurantIds } from "@/utils/restaurants";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { findOrderByCarrierOrderId, updateOrderDispute, insertOrdersBulk } from "@/utils/order_processing";
import { loadAuthCache, saveAuthCache } from "@/utils/auth_cache";

async function login(browser: Browser, page: Page, email: string) {
  const password = process.env.DOORDASH_PASSWORD;

  if (!email) {
    throw new Error("Email is required for DoorDash login");
  }

  if (!password) {
    throw new Error("DOORDASH_PASSWORD must be set in .env file");
  }

  console.log(`Starting DoorDash login for ${email}...`);

  // Wait for email input to be visible
  await page.waitForSelector('[data-anchor-id="IdentityLoginPageEmailField"]', { timeout: 10000 });
  await page.type('[data-anchor-id="IdentityLoginPageEmailField"]', email);

  // Click continue to move to password field
  await page.click('#merchant-login-submit-button');

  // Wait for password field
  await page.waitForSelector('[data-anchor-id="IdentityLoginPagePasswordField"]', { timeout: 10000 });
  await page.type('[data-anchor-id="IdentityLoginPagePasswordField"]', password);

  // Submit login form
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    page.click('#login-submit-button')
  ]);

  console.log("✓ Login complete!");
}

async function extractAuthData(page: Page) {
  console.log('\nExtracting authentication data...');
  console.log('Navigating to operations quality page to capture request data...');

  let capturedHeaders: any = null;
  let capturedCookies: string | undefined;

  // Get store ID first
  const storeId = await page.evaluate(() => {
    const mxClientViewState = localStorage.getItem('mx-client-view-state');
    if (mxClientViewState) {
      try {
        const parsed = JSON.parse(mxClientViewState);
        return parsed.clientViewState?.store?.id;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  if (storeId) {
    // Use CDP (Chrome DevTools Protocol) to capture the entire request
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');

    client.on('Network.requestWillBeSent', (params: any) => {
      // Capture the request to merchant-analytics-service
      if (params.request.url.includes('merchant-analytics-service')) {
        console.log(`\n✓ Found API request to: ${params.request.url}`);
        capturedHeaders = params.request.headers;
        capturedCookies = capturedHeaders['cookie'] || capturedHeaders['Cookie'];
        console.log(`  Captured ${Object.keys(capturedHeaders).length} headers`);
        console.log(`  dd-att-key: ${capturedHeaders['dd-att-key'] ? 'YES' : 'NO'}`);
      }
    });

    // Navigate to operations quality page to trigger API request
    await page.goto(`https://merchant-portal.doordash.com/merchant/operations-quality?store_id=${storeId}`, {
      waitUntil: "networkidle2",
    });

    console.log('  Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click the button that opens the modal to trigger the API request
    console.log('  Looking for button to open modal...');
    try {
      await page.waitForSelector('a[kind="BUTTON/LINK"]', { timeout: 5000 });
      await page.click('a[kind="BUTTON/LINK"]');
      console.log('  Clicked button, waiting for API request...');

      // Wait for API calls to be made
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log('  ⚠️  Could not find or click button, trying to capture anyway...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await client.detach();
  }

  // Get all cookies from the page
  const pageCookies = await page.cookies();
  const allCookiesString = pageCookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log(`  Captured ${pageCookies.length} cookies from page`);

  // Get store info from localStorage
  const storeData = await page.evaluate(() => {
    const mxClientViewState = localStorage.getItem('mx-client-view-state');
    if (mxClientViewState) {
      try {
        const parsed = JSON.parse(mxClientViewState);
        return {
          storeId: parsed.clientViewState?.store?.id,
          storeName: parsed.clientViewState?.store?.name,
          businessId: parsed.clientViewState?.business?.id
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const authData = {
    ddAttKey: capturedHeaders?.['dd-att-key'],
    storeId: storeData?.storeId,
    storeName: storeData?.storeName,
    businessId: storeData?.businessId,
    cookies: allCookiesString, // Use all page cookies
    allHeaders: capturedHeaders
  };

  console.log('\n📋 Authentication Data:');
  console.log(JSON.stringify({
    ddAttKey: authData.ddAttKey,
    storeId: authData.storeId,
    storeName: authData.storeName,
    businessId: authData.businessId,
    cookies: '[hidden]',
    headersCount: capturedHeaders ? Object.keys(capturedHeaders).length : 0
  }, null, 2));

  if (!capturedHeaders || !authData.ddAttKey) {
    console.log('\n⚠️  Warning: Request data was not captured. API requests may fail.');
  }

  return authData;
}

async function fetchOrdersPage(
  authData: any,
  storeId: string,
  startDate: string,
  endDate: string,
  offset: number = 0,
  limit: number = 15
) {
  // Build headers object - use captured headers if available, otherwise construct manually
  let headers: any = authData.allHeaders ? {
    ...authData.allHeaders
  } : {
    'accept': 'application/json',
    'accept-language': 'en-US',
    'baggage': 'sentry-environment=production,sentry-release=app-merchant%408.57.3,sentry-public_key=dae9a26772e141f1b64735f92353c085,sentry-trace_id=7e1bed15c5c0483fae01423522856ac0,sentry-sample_rate=0.2,sentry-sampled=false',
    'client-version': 'web version 2.0',
    'content-type': 'application/json',
    'dd-att-key': authData.ddAttKey || '',
    'origin': 'https://merchant-portal.doordash.com',
    'origin-app': 'merchant_portal',
    'priority': 'u=1, i',
    'referer': `https://merchant-portal.doordash.com/merchant/operations-quality?store_id=${storeId}`,
    'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Cookie': authData.cookies
  };

  // Override referer to match current request (case-insensitive removal of duplicates)
  delete headers['Referer'];
  delete headers['referer'];
  headers['referer'] = `https://merchant-portal.doordash.com/merchant/operations-quality?store_id=${storeId}`;

  // Ensure cookies are set
  if (!headers['Cookie'] && !headers['cookie']) {
    headers['Cookie'] = authData.cookies;
  }

  if (!authData.ddAttKey && !authData.allHeaders) {
    console.log('\n⚠️  Warning: dd-att-key not found in auth data');
  }

  console.log(`\n  Making request with dd-att-key: ${headers['dd-att-key'] ? 'YES' : 'NO'}`);

  const body = JSON.stringify({
    metricType: 'ORDER_ERRORS',
    startDate,
    endDate,
    includeCategoriesCount: true,
    limit,
    timeFilterGranularity: 4,
    businessIds: [],
    storeIds: [parseInt(storeId)],
    offset
  });

  // Generate curl command for testing
  const curlHeaders = Object.entries(headers)
    .filter(([key]) => key.toLowerCase() !== 'cookie') // Filter out cookie to add it separately
    .map(([key, value]) => `  -H '${key}: ${value}'`)
    .join(' \\\n');

  // Add cookie header separately with -b flag for better readability
  const cookieHeader = headers['Cookie'] || headers['cookie'] || authData.cookies;
  const curlCommand = `curl 'https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/operations_quality/metric_breakdown' \\\n${curlHeaders} \\\n  -H 'Cookie: ${cookieHeader}' \\\n  --data-raw '${body}'`;

  console.log('\n📋 Test this request in your terminal:\n');
  console.log(curlCommand);
  console.log('\n');

  const response = await fetch('https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/operations_quality/metric_breakdown', {
    method: 'POST',
    headers,
    body
  });

  return await response.json();
}

async function fetchOrders(authData: any, storeId: string) {
  console.log('\nFetching DoorDash orders with pagination...');

  // Use 18-day lookback window to match working request
  const startDate = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  console.log(`Date range: ${startDate} to ${endDate} (18 days)`);
  console.log(`Store ID: ${storeId}`);

  let allOrders: any[] = [];
  let offset = 0;
  const limit = 15;
  let hasMore = true;
  let pageNumber = 1;

  while (hasMore) {
    console.log(`\n  Fetching page ${pageNumber} (offset: ${offset})...`);

    try {
      const data = await fetchOrdersPage(authData, storeId, startDate, endDate, offset, limit);

      if (data.error) {
        console.error(`  ✗ API Error:`, data.error);
        break;
      }

      const orders = data?.orderErrorsList || [];
      allOrders = allOrders.concat(orders);

      console.log(`  ✓ Fetched ${orders.length} orders (total: ${allOrders.length})`);

      // Check if there are more pages
      hasMore = orders.length === limit;
      offset += limit;
      pageNumber++;

      // Small delay between requests to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`  ✗ Error fetching page ${pageNumber}:`, error);
      break;
    }
  }

  console.log(`\n✓ Completed fetching all pages: ${allOrders.length} total orders`);

  // Save all orders to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `doordash_orders_${storeId}_${timestamp}.json`;
  const dataDir = join(process.cwd(), 'data');
  const filepath = join(dataDir, filename);

  try {
    // Create data directory if it doesn't exist
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(filepath, JSON.stringify({ orderErrorsList: allOrders }, null, 2));
    console.log(`✓ Orders saved to: ${filepath}`);
  } catch (error) {
    console.error(`✗ Failed to save orders to file:`, error);
  }

  return allOrders;
}

async function fetchOrderDetails(authData: any, storeId: string, deliveryUuid: string) {
  // Build headers - use captured headers or construct manually
  let headers: any = authData.allHeaders ? {
    ...authData.allHeaders
  } : {
    'accept': 'application/json',
    'accept-language': 'en-US',
    'baggage': 'sentry-environment=production,sentry-release=app-merchant%408.57.3,sentry-public_key=dae9a26772e141f1b64735f92353c085,sentry-trace_id=7e1bed15c5c0483fae01423522856ac0,sentry-sample_rate=0.2,sentry-sampled=false',
    'client-version': 'web version 2.0',
    'content-type': 'application/json',
    'dd-att-key': authData.ddAttKey || '',
    'origin-app': 'merchant_portal',
    'priority': 'u=1, i',
    'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Cookie': authData.cookies
  };

  // Override referer
  delete headers['Referer'];
  delete headers['referer'];
  headers['referer'] = `https://merchant-portal.doordash.com/merchant/operations-quality?store_id=${storeId}`;

  // Ensure cookies are set
  if (!headers['Cookie'] && !headers['cookie']) {
    headers['Cookie'] = authData.cookies;
  }

  const body = JSON.stringify({
    country: 'US',
    storeId: parseInt(storeId),
    deliveryUuid
  });

  const response = await fetch('https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/orders_details/', {
    method: 'POST',
    headers,
    body
  });

  return await response.json();
}

async function main() {
  // Get store IDs with restaurant mappings from Supabase
  const storeMappings = await getDoorDashRestaurantIds();

  // Group stores by email
  const storesByEmail = storeMappings.reduce((acc: any, store) => {
    const email = store.email;
    if (!acc[email]) {
      acc[email] = [];
    }
    acc[email].push(store);
    return acc;
  }, {});

  const emails = Object.keys(storesByEmail);
  console.log(`\n📧 Found ${emails.length} unique email(s) with ${storeMappings.length} total store(s)\n`);

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process each email group separately
  for (const email of emails) {
    const stores = storesByEmail[email];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📧 Processing ${stores.length} store(s) for email: ${email}`);
    console.log(`${'='.repeat(60)}\n`);

    // Try to load cached authentication for this email
    const cacheKey = `doordash_${email}`;
    let authData = loadAuthCache(cacheKey);

    // If no valid cache, perform login
    if (!authData) {
      const browser = new Browser();

      try {
        console.log(`Launching browser for ${email}...`);
        await browser.launch(false); // Debug mode - show browser

        const page = await browser.newPage();

        console.log("Navigating to DoorDash merchant portal...");

        // Navigate to DoorDash merchant login page
        await page.goto("https://merchant-portal.doordash.com/login", {
          waitUntil: "networkidle2",
        });

        await login(browser, page, email);

        // Navigate to merchant portal after successful login
        console.log("Navigating to merchant portal...");
        await page.goto("https://merchant-portal.doordash.com/merchant", {
          waitUntil: "networkidle2",
        });

        // Extract authentication data
        authData = await extractAuthData(page);

        // Save auth to cache with email-specific key
        saveAuthCache(authData, cacheKey);

        await browser.close();
        console.log("Browser closed.");
      } catch (error) {
        console.error(`Error during login for ${email}:`, error);
        await browser.close();
        totalErrors++;
        continue; // Skip processing stores for this email
      }
    }

    // Process all stores for this email
    try {
      for (const { storeId, restaurantId } of stores) {
        const orders = await fetchOrders(authData, storeId);

        console.log(`\n\n🔄 Processing ${orders.length} disputed order items for store ${storeId}...\n`);

        // Initialize array to collect orders to insert
        const ordersToInsert: any[] = [];

        // Group orders by deliveryUuid to avoid duplicate API calls and sum charges
        const ordersByDelivery = orders.reduce((acc: any, order: any) => {
          if (!acc[order.deliveryUuid]) {
            // Clean customer name - remove trailing period if present
            let customerName = order.customerName || 'Unknown';
            if (customerName.endsWith('.')) {
              customerName = customerName.slice(0, -1);
            }

            acc[order.deliveryUuid] = {
              deliveryUuid: order.deliveryUuid,
              customerName,
              totalAmountCharged: 0,
              items: []
            };
          }
          acc[order.deliveryUuid].totalAmountCharged += order.amountCharged || 0;
          acc[order.deliveryUuid].items.push({
            itemName: order.itemAtFault?.[0]?.name || 'Unknown',
            amountCharged: order.amountCharged || 0
          });
          return acc;
        }, {});

        const uniqueDeliveries = Object.values(ordersByDelivery);
        console.log(`  Found ${uniqueDeliveries.length} unique deliveries with disputes\n`);

        for (const delivery of uniqueDeliveries) {
          try {
            const { deliveryUuid, customerName, totalAmountCharged, items } = delivery as any;

            console.log(`  Processing delivery ${deliveryUuid} - ${customerName}...`);
            console.log(`    Total disputed amount from error list: $${(totalAmountCharged / 100).toFixed(2)} (${items.length} items)`);

            // Fetch full order details
            console.log(`    Fetching order details...`);
            const response = await fetchOrderDetails(authData, storeId, deliveryUuid);

            if (!response || response.error || !response.data) {
              console.log(`    ⚠️  Failed to fetch order details, skipping`);
              totalErrors++;
              continue;
            }

            const orderDetails = response.data;

            const orderDateStr = orders.find((o: any) => o.deliveryUuid === deliveryUuid)?.createdAt;
            const orderDate = orderDateStr ? new Date(orderDateStr) : undefined;

            // Find order in database using delivery UUID, customer name, and timeframe
            const dbOrder = await findOrderByCarrierOrderId(deliveryUuid, customerName, orderDate);

            if (!dbOrder) {
              console.log(`    📝 Order not found in database, will be saved...`);

              // Determine if dispute was accepted - if we got a refund, we won
              const refundAmount = orderDetails.refunds?.unitAmount || 0;
              const disputeAccepted = refundAmount > 0;

              // Get the total error charge amount (in cents, convert to dollars)
              const chargebackAmount = (orderDetails.errorCharges?.unitAmount || 0) / 100;

              // Extract items from orderDetails if available
              const orderItems = orderDetails.items || items || [];

              // Prepare order data for bulk insert
              const orderData = {
                carrier: 'doordash',
                order_number: deliveryUuid,
                carrier_order_id: deliveryUuid,
                restaurant_id: restaurantId,
                customer_name: customerName,
                disputed: true,
                dispute_accepted: disputeAccepted,
                dispute_amount: chargebackAmount,
                items: orderItems,
                created_at: orderDate ? orderDate.toISOString() : undefined
              };

              ordersToInsert.push(orderData);
              continue;
            }

            // Determine if dispute was accepted - if we got a refund, we won
            const refundAmount = orderDetails.refunds?.unitAmount || 0;
            const disputeAccepted = refundAmount > 0;

            // Get the total error charge amount (in cents, convert to dollars)
            const chargebackAmount = (orderDetails.errorCharges?.unitAmount || 0) / 100;

            // Update the found order
            await updateOrderDispute(dbOrder.id, disputeAccepted, chargebackAmount);

            console.log(`    ✓ Updated: disputed=true, dispute_accepted=${disputeAccepted}, amount=$${chargebackAmount.toFixed(2)}`);
            totalProcessed++;

            // Small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error) {
            const { deliveryUuid } = delivery as any;
            console.error(`    ✗ Error processing delivery ${deliveryUuid}:`, error);
            totalErrors++;
          }
        }

        // Bulk insert orders that weren't found in the database
        if (ordersToInsert.length > 0) {
          console.log(`\n  💾 Bulk inserting ${ordersToInsert.length} new orders for store ${storeId}...`);
          const result = await insertOrdersBulk(ordersToInsert);
          
          if (result.errors.length > 0) {
            console.error(`  ⚠️  ${result.errors.length} errors during bulk insert`);
            totalErrors += result.errors.length;
          }
          
          totalProcessed += result.inserted;
          console.log(`  ✓ Successfully inserted ${result.inserted} orders`);
        }
      }

    } catch (error) {
      console.error(`Error processing stores for ${email}:`, error);
      totalErrors++;
    }

    console.log(`\n✓ Completed processing for email: ${email}\n`);
  }

  console.log('\n\n=== Processing Summary ===');
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
}

main();
