# Getting Started

This page is intended as the entry point for new users.

## 1. Run The App

Requirements:

- Node.js 18 or higher
- npm

Start commands:

```bash
npm install
npm start
```

Run automated tests:

```bash
npm test              # run all tests once
npm run test:watch    # watch mode for development
npm run test:coverage # with coverage report
```

Default values:

- App URL: `http://localhost:3001`
- Main page: `http://localhost:3001/`
- Runtime status: `http://localhost:3001/status`
- Demo learning path: `http://localhost:3001/demo.html`

## 2. Learn In This Order

1. Read [Endpoints And Responses](./endpoints.md)
2. Open [JMeter Guide](./jmeter.md)
3. Then move on to [Test Matrix And Thread Groups](./test-matrix.md)

## 3. If You Prefer The Browser Pages

- `GET /` is the main overview page
- `/demo.html` is the starting page for the demo flow
- `/demo-endpoints.html` starts from the endpoint view
- `/demo-jmeter.html` covers the JMeter structure
- `/demo-test-types.html` for selecting thread groups and test types

## 4. What To Learn First

Start with this demo flow:

1. `GET /demo/context?search=mouse`
2. `GET /demo/dashboard`
3. `GET /demo/search?q=${demoSearchTerm}`
4. `GET /demo/product/details?productId=${demoProductId}`
5. `POST /demo/cart/add`
6. `POST /demo/checkout`
7. `GET /demo/order/status?orderId=${demoOrderId}`

Reasons:

- It includes both `GET` and `POST` requests
- It covers query parameters, request bodies, extractors, and variable chaining
- It can be used to demonstrate `Transaction Controller`, `Throughput Controller`, and `If Controller`

## 5. When To Read The Other Docs

- To set environment variables: [Configuration Reference](./configuration.md)
- To run via container: [Docker Guide](./docker.md)
- To find a test profile or thread group: [Test Matrix And Thread Groups](./test-matrix.md)
