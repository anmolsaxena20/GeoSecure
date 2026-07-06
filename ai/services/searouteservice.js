/*
USE:
- Calculate maritime shipping distance
- Estimate shipping time
- Compare alternative sea routes
- Compute logistics cost
*/

import { seaRoute } from "searoute-ts";

const route = seaRoute(
    [72.8777, 19.0760],
    [103.8198, 1.3521]
);

console.log(route);