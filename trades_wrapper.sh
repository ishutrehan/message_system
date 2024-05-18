#!/bin/bash
cd /root/bybit
export DATABASE_URL="mysql://pg:99timesx@46.101.74.53:3306/betfair?pool_timeout=60"
xvfb-run --auto-servernum node liveTrades.js

#0 0 * * * cd /root/bybit && timeout 10m xvfb-run --auto-servernum node liveTraders
