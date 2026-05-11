# JMeter Guide

This page is ordered by the sequence for building a test plan, aimed at beginners.

## Learn In This Order

1. Configure `HTTP Request Defaults`
2. Try a single endpoint first and get it passing
3. Build the demo transaction flow
4. Add extractors and variable chaining
5. Add controllers based on your goals
6. Gradually scale up to a load test

## Step 1: Base Test Plan

```text
Test Plan
├─ User Defined Variables
├─ HTTP Request Defaults
├─ Thread Group
│  ├─ HTTP Request
│  └─ View Results Tree
└─ Summary Report
```

Recommended settings:

- Protocol: `http`
- Server: `localhost`
- Port: `3001`
- Threads: `1`
- Ramp-Up: `1`
- Loop Count: `1`

Use this structure to try a single endpoint, such as:

- `/demo/dashboard`
- `/fast`
- `/prep`

Values to put in `User Defined Variables` from the start:

- `protocol=http`
- `host=localhost`
- `port=3001`
- `acceptHeader=application/json`
- `contentType=application/json`

Reasons:

- Change environments from a single location
- Easy to use with `HTTP Request Defaults` and `HTTP Header Manager`

## Step 2: Demo Transaction Flow

Once a single endpoint passes, expand to this flow.

```text
Test Plan
├─ HTTP Request Defaults
├─ Thread Group
│  └─ Transaction Controller - Demo Commerce Flow
│     ├─ HTTP Request - demo context
│     │  └─ JSON Extractor
│     ├─ HTTP Request - demo dashboard
│     ├─ HTTP Request - demo search
│     ├─ HTTP Request - product details
│     ├─ HTTP Request - add to cart
│     ├─ HTTP Request - checkout
│     │  └─ JSON Extractor
│     └─ HTTP Request - order status
├─ View Results Tree
└─ Summary Report
```

Enable `Generate parent sample` on the `Transaction Controller`.

Request order:

1. `GET /demo/context?search=mouse`
2. `GET /demo/dashboard`
3. `GET /demo/search?q=${demoSearchTerm}`
4. `GET /demo/product/details?productId=${demoProductId}`
5. `POST /demo/cart/add`
6. `POST /demo/checkout`
7. `GET /demo/order/status?orderId=${demoOrderId}`

## Step 3: Extract Values From JSON

Values to extract from `/demo/context`:

- `$.cartId -> demoCartId`
- `$.shopperId -> demoShopperId`
- `$.recommendedProductId -> demoProductId`
- `$.searchTerm -> demoSearchTerm`

Values to extract from `/demo/checkout`:

- `$.orderId -> demoOrderId`

Example `JSON Extractor` configuration:

- Names of created variables: `demoOrderId`
- JSON Path expressions: `$.orderId`
- Match No.: `1`
- Default Values: `NOT_FOUND`

## Step 3.1: Add User Defined Variables First

To start the flow quickly and keep things organized, configure `User Defined Variables` up front.

Recommended values for this system:

- `protocol=http`
- `host=localhost`
- `port=3001`
- `acceptHeader=application/json`
- `contentType=application/json`
- `demoSearchTerm=mouse`
- `demoProductId=sku-101`
- `demoCartId=demo-cart`
- `demoShopperId=demo-user-01`
- `demoQuantity=1`
- `demoAuthToken=lab-token`
- `demoLanguage=en`
- `demoOrderId=NOT_SET`

Reasons:

- `mouse` finds a product when searched in the demo
- `sku-101` is a demo product that actually exists
- `demo-cart` and `demo-user-01` serve as fallbacks before extractors are in place
- `lab-token` matches the default value for `/protected`
- `en` is the default language that is easiest to read, and can be switched to `th` via `Accept-Language`
- `NOT_SET` makes it clear that `demoOrderId` is not yet ready for use

Suggested grouping by role:

- infrastructure defaults: `protocol`, `host`, `port`
- shared headers: `acceptHeader`, `contentType`
- business defaults: `demoSearchTerm`, `demoProductId`, `demoCartId`, `demoShopperId`
- auth defaults: `demoAuthToken`
- locale defaults: `demoLanguage`
- runtime placeholders: `demoOrderId`

Usage approach:

- Start with these values for the initial proof of concept
- Once `JSON Extractor` is in use, let response values override the existing variables
- `demoOrderId` should not be hardcoded for real use — let `/demo/checkout` generate it

## Step 4: Send JSON Body Correctly

For `POST /demo/cart/add`:

- Header: `Content-Type: application/json`
- Body:

```json
{
  "cartId": "${demoCartId}",
  "productId": "${demoProductId}",
  "quantity": 1
}
```

For `POST /demo/checkout`:

- Header: `Content-Type: application/json`
- Body:

```json
{
  "cartId": "${demoCartId}",
  "customerId": "${demoShopperId}"
}
```

## Step 4.1: Recommended HTTP Header Structure

Header values to use as a baseline structure:

- `Accept=${acceptHeader}`
- `Accept-Language=${demoLanguage}`
- `Content-Type=${contentType}` for JSON POST requests
- `x-access-token=${demoAuthToken}` or `Authorization=Bearer ${demoAuthToken}` for `/protected`

Header placement approach:

- Place `Accept` at the Test Plan or Thread Group level if most requests expect JSON
- Place `Accept-Language` at the Test Plan or Thread Group level if the whole flow uses one language
- Place `Content-Type` only on samplers that send a JSON body
- Place auth headers only on samplers that require a token

Reasons:

- Reduces hardcoding
- Reduces the risk of GET requests receiving unnecessary headers
- Allows token or content type to be updated from a single location

## Step 5: Add Useful Controllers

### Transaction Controller

Use when:

- You want to measure the total time of a flow
- You want to read results as a business transaction

### Throughput Controller

Use when:

- You want certain flows to occur only for a portion of traffic
- For example, all users browse but only some proceed to checkout

Example:

```text
Thread Group
├─ Transaction Controller - Browse Flow
├─ Throughput Controller - Cart Flow (40%)
│  └─ Transaction Controller - Add And Checkout
└─ If Controller - if demoOrderId exists
   └─ HTTP Request - order status
```

Important notes:

- When using `Percent Executions` mode
- `40` means `40%`
- `100` means `100%`
- `1.0` does not mean `100%`

### If Controller

Use when:

- The next request depends on a value from the previous response
- For example, `order status` requires an `orderId`

Example condition:

```text
${__groovy(vars.get("demoOrderId") != null && vars.get("demoOrderId") != "NOT_FOUND" && !vars.get("demoOrderId").isEmpty())}
```

### JSR223 PreProcessor

Use when:

- You want to generate variables before firing a request
- You want to change query parameters or body values dynamically

Example:

```groovy
vars.put("prepPrefix", "test-" + System.currentTimeMillis())
```

### tearDown Thread Group

Use when:

- You need to clean up data after the test completes

```text
tearDown Thread Group
└─ HTTP Request - POST /cleanup
```

## Step 6: Move From Functional To Load Test

Use this progression:

1. `1 user`, `1 loop`
2. `5 users`, `5 loops`
3. `10-20 users` to collect a baseline
4. Gradually increase to load, stress, spike, endurance

Example baseline for the demo flow:

- Threads: `5`
- Ramp-Up: `5 sec`
- Loop Count: `10`

## What To Measure

- Parent sample of `Transaction Controller`
- Response time of each step
- Error rate
- Sample count of flows under `Throughput Controller`

## SLA By Test Type

SLAs should not be applied uniformly across all test types.

| Test Type | Should You Use It For SLA? | What It Usually Proves |
| --- | --- | --- |
| `Load Test` | Yes, it is the primary type | Whether the system still meets SLA under expected real traffic |
| `Stress Test` | Yes, but as a threshold SLA | At what load level the system begins to degrade or fail |
| `Spike Test` | Yes, if the SLA mentions peak or recovery | Whether the system handles sudden load spikes and how long recovery takes |
| `Endurance Test` | Yes, if the SLA mentions stability | Whether the SLA remains stable or drifts over extended runs |

## SLA Statement To Test Type Mapping

| If The SLA Says | Use This Test Type First | Why |
| --- | --- | --- |
| Must support users or requests under normal conditions | `Load Test` | Proves the primary target under expected traffic |
| Must not fail even under higher-than-normal load | `Stress Test` | Finds the degradation point and failure threshold |
| Must withstand traffic peaks or flash sales | `Spike Test` | Simulates abnormally fast load spikes |
| Must remain stable throughout the day or for several hours | `Endurance Test` | Catches latency drift, leaks, and late-cycle stability |

## Practical SLA Statements

| Example SLA Statement | Recommended Test Type | What To Measure |
| --- | --- | --- |
| Under normal weekday traffic, product search must complete with `p95 < 700 ms` and error rate below `1%`. | `Load Test` | `/demo/search` percentile and error % at expected user/rate level |
| At expected business load, the full checkout journey must complete within `1.5 s` for `95%` of users. | `Load Test` | parent sample of `Transaction Controller - Add And Checkout` |
| The service must remain available until at least `80 concurrent users`; after that point graceful degradation is acceptable. | `Stress Test` | The point at which error rate rises or latency breaches when increasing concurrency |
| During campaign launch, traffic may jump to `3x` normal within one minute, and the API must recover within `2 minutes`. | `Spike Test` | Latency jump, error burst, and recovery time after spike |
| The platform must keep `p95 < 900 ms` for browsing traffic throughout an `8-hour` business window. | `Endurance Test` | Percentile trend throughout the period, not just at the start |
| No more than `40%` of browse sessions should proceed to cart and checkout in the standard usage model. | `Load Test` with `Throughput Controller` | Sample count of browse flow compared to cart flow |

## SLA Statement To Metric To JMeter Component

| SLA Statement Type | Main Metric | Main JMeter Component | Pass/Fail Example |
| --- | --- | --- | --- |
| dashboard/search must be fast | `p95`, `error %` | `Aggregate Report` | pass if `95% < 700 ms` and error `< 1%` |
| checkout journey must be fast | transaction `p95` | `Transaction Controller` parent sample | pass if total flow `< 1.5 s` at the specified load |
| traffic mix must reflect real usage | flow count ratio | `Throughput Controller` + report sample count | pass if cart flow is close to `40%` of browse flow |
| must not fail before target concurrency | error threshold, latency breach point | `Concurrency Thread Group` + `Aggregate Report` | pass if target is not breached before `80 users` |
| must recover after peak | recovery time, post-spike error/latency | `Stepping` or `Concurrency` + trend reports | pass if the system returns to target within the stated time |
| must remain stable for several hours | p95 drift, throughput drift, error drift | `Backend Listener`, `Summary Report`, `Aggregate Report` | pass if end-of-run values are still within target |

## Example Analysis

```text
Statement
"At expected business load, the full checkout journey must complete within 1.5 s for 95% of users."

Analysis
- This is a user journey statement, not a single endpoint statement
- Main metric is transaction p95
- Main test type is Load Test
- Best component is Transaction Controller parent sample
- Pass only if tested at expected load, not at 1 user only
```

```text
Statement
"The service must remain available until at least 80 concurrent users; after that point graceful degradation is acceptable."

Analysis
- This is a capacity threshold statement
- Main test type is Stress Test
- Best thread group is Concurrency Thread Group
- Pass if the system still meets availability/error target below 80 concurrent users
- After 80, slower response or some rejection may be acceptable depending on the statement
```

```text
Statement
"During campaign launch, traffic may jump to 3x normal within one minute, and the API must recover within 2 minutes."

Analysis
- This is not a normal SLA-only statement
- Main test type is Spike Test
- Focus on error burst, percentile jump, and recovery window
- Pass only if the system returns to acceptable latency/error within the stated recovery time
```

## Next Step

- To choose a thread group: [Test Matrix And Thread Groups](./test-matrix.md)
- To review endpoints and responses first: [Endpoints And Responses](./endpoints.md)
