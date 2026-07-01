# Market Research & Competitive Analysis

We looked at every existing option an Indian EV driver can use today to plan charging. The gap is significant — and it's not about missing features, it's about a fundamental architecture mismatch. Every existing solution either requires constant cloud connectivity, is locked to one charging network, or treats the battery as a black box.

---

## Feature Benchmarking

| Capability | ChargeWise EdgeAI | Tata Power EZ Charge | Jio-bp Pulse | Zeon | Magenta ChargeGrid | Ather Grid | Google Maps |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Offline route recommendations | **Yes (edge)** | No | No | No | No | No | No |
| Battery SOH-aware optimization | **Yes** | No | No | No | No | Partial | No |
| MSEDCL tariff prediction | **Yes** | No | No | No | No | No | No |
| Real-time charger wait estimation | **Yes** | No | No | No | No | No | No |
| Thermal safety guardrails | **Yes (AIS 156)** | No | No | No | No | Yes | No |
| Multi-stop route optimization | **Yes** | No | No | No | No | No | Yes |
| Cross-network compatibility | **Yes** | No | No | No | No | No | Yes |

*"Partial" on Ather Grid SOH: Ather does active thermal management on their own hardware, but it doesn't influence route planning or charging stop recommendations.*

---

## What's actually broken with current options

**OEM apps (Tata ZConnect, Ather Grid):** These are walled gardens. They work well within their ecosystem but won't cross-reference Jio-bp or Zeon stations. More importantly, their routing engines run in the cloud, so you lose recommendations the moment you're in the Ghats with weak signal. And while they have some thermal management on the hardware side, none of them use it to dynamically adjust their charging recommendations — "charge here vs. charge there based on your battery temperature and the tariff window" is not something any of them do.

**Indian charging network apps (Tata Power EZ Charge, Jio-bp Pulse, Zeon, Magenta):** These are essentially directories. They show you where stations are and whether they're occupied. That's it. They have no access to your CAN-bus telemetry, no concept of battery state of health, and no awareness of electricity pricing dynamics. A driver today has to use 3-4 separate apps to compare options from different networks, and none of them tell you whether your battery can actually make it to a station.

**Google Maps / navigation apps:** Good at the basic multi-stop route planner, but they treat an EV like a petrol car with a range limit. No tariff awareness, no health optimization, no thermal protection. The range estimate is static (the distance declared by the manufacturer), not a real-time calculation from your actual battery state.

---

## The gap ChargeWise fills

Three things that don't exist anywhere in the Indian market today:

1. **Local intelligence on the vehicle.** Our edge architecture means charging recommendations are generated on the vehicle itself, using live CAN-bus data, not a cloud server's outdated cache. A Tata Nexon EV running through rural Maharashtra with no LTE still gets a charging plan from ChargeWise.

2. **Battery health as a first-class input to routing decisions.** We don't just route you to the nearest fast charger. If your battery is showing elevated internal resistance or your cell group voltage is unbalanced, we route you to a slower charger — because a 50 kW session on a degraded pack does more damage per km of range gained than a 22 kW session. That tradeoff calculation doesn't exist in any competitor today.

3. **MSEDCL tariff integration.** We're the only platform predicting Time-of-Day tariff windows and factoring them into route stop decisions. Charging at 22:00 instead of 18:00 can cut a Mumbai charging session cost by ₹60-80 on a Nexon EV. Our optimizer surfaces that savings automatically.
