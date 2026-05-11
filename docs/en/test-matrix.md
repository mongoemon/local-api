# Test Matrix And Thread Groups

This page is a reference to consult after you have built a working flow in JMeter.

## 1. Choose The Right Thread Group

| Thread Group | Best For | Use When | Not The First Choice When |
| --- | --- | --- | --- |
| `Normal` | baseline, debug, simple SLA | you want to start simply and get the flow passing first | you need to control concurrency or arrival rate |
| `Concurrency` | stress, saturation, active sessions | you want to control the number of concurrent users | you just need to debug an ordinary request |
| `Stepping` | spike, threshold | you want to know which step the system starts to fail at | you want to control rate per second |
| `Arrival` | steady traffic, open workload | you want to control workload as requests/sec | you want to control active sessions directly |

## 2. Match Thread Group To Test Type

| Test Type | Recommended Thread Group | Goal |
| --- | --- | --- |
| `Load` | `Normal`, `Concurrency`, `Arrival` | check whether the system still meets SLA under normal load |
| `Stress` | `Concurrency` | find the limit and saturation point |
| `Spike` | `Stepping`, `Concurrency` | observe the effect when traffic spikes rapidly |
| `Endurance` | `Normal`, `Concurrency`, `Arrival` | observe degradation over a long duration |

## 3. Recommended Structures

### Load Test

```text
Test Plan
├─ HTTP Request Defaults
├─ Thread Group or Concurrency Thread Group or Arrival Thread Group
│  ├─ Transaction Controller - Browse Flow
│  ├─ Throughput Controller - Cart Flow
│  └─ If Controller - order status
├─ Summary Report
└─ Aggregate Report
```

Starting values:

- `Normal`: `10-30 users`, `20-60 sec ramp-up`, `50-200 loops`
- `Concurrency`: target `20-50`, hold `300 sec`
- `Arrival`: target `10-30/sec`, hold `300 sec`

### Stress Test

```text
Test Plan
├─ HTTP Request Defaults
├─ Concurrency Thread Group
│  ├─ target endpoint or transaction flow
│  ├─ Summary Report
│  └─ Aggregate Report
├─ tearDown Thread Group
│  └─ HTTP Request - cleanup
└─ View Results Tree
```

Starting values:

- target concurrency `20`
- ramp-up `60 sec`
- steps `5`
- hold `120 sec`

Then gradually increase `20 -> 50 -> 100`

### Spike Test

```text
Test Plan
├─ HTTP Request Defaults
├─ Stepping Thread Group or Concurrency Thread Group
│  ├─ target endpoint or transaction flow
│  ├─ Summary Report
│  └─ Aggregate Report
└─ View Results Tree
```

Starting values:

- `Stepping`: `20-50 users per step`, `5 sec step period`, `30-60 sec flight time`
- `Concurrency`: target `50-150`, ramp-up `10-30 sec`

### Endurance / Soak Test

```text
Test Plan
├─ HTTP Request Defaults
├─ Thread Group or Concurrency Thread Group or Arrival Thread Group
│  ├─ target endpoint or demo flow
│  ├─ Summary Report
│  └─ Backend Listener
├─ tearDown Thread Group
│  └─ HTTP Request - cleanup
└─ View Results Tree
```

Starting values:

- `Normal`: `20-50 users`, duration `30-120 min`
- `Concurrency`: target `20-40`, hold `30-120 min`
- `Arrival`: target `5-15/sec`, hold `30-120 min`

## 4. Endpoint To Test Type Mapping

| Endpoint / Flow | Best Test Types | What You Usually Watch |
| --- | --- | --- |
| `/fast` | load, endurance, rate limit | p95, throughput, 429 |
| `/slow` | load, endurance | latency drift |
| `/busy` | stress, spike | 503, saturation |
| `/cpu` | stress | CPU-driven latency growth |
| `/memory` | stress, endurance | memory pressure, degradation |
| `/io?mode=write` | stress, endurance | I/O latency |
| `/demo` transaction flow | load, stress, endurance | parent sample latency, checkout ratio |
| `/protected` | functional load, auth validation | 200/401/403 split |

## 5. Quick Decision Guide

| If The Goal Is | Start With |
| --- | --- |
| A single endpoint must meet an SLA | `Normal Thread Group` |
| An entire flow needs its total time measured | `Transaction Controller` under `Normal Thread Group` |
| Not all users proceed to checkout | Add `Throughput Controller` |
| A subsequent request depends on a value from the previous response | Add `If Controller` + `JSON Extractor` |
| Control concurrent sessions | `Concurrency Thread Group` |
| Find the break point step by step | `Stepping Thread Group` |
| Control workload as requests/sec | `Arrival Thread Group` |

## 6. Suggested Reading Order

1. [Getting Started](./getting-started.md)
2. [Endpoints And Responses](./endpoints.md)
3. [JMeter Guide](./jmeter.md)
4. Return to this page once the flow is working
