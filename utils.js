import crypto from 'crypto'

export const calcHashForLiveTrade = (row) => {
  const { symbol, entryPrice, sizeX, createdAtE3, side, leverageE2, isIsolated, transactTimeE3, stopLossPrice, takeProfitPrice, orderCostE8, reCalcEntryPrice, positionEntryPrice, positionCycleVersion, crossSeq, closeFreeQtyX, minPositionCostE8, positionBalanceE8, traderID, leaderFollowerCount, traderName } = row;

  const data = symbol + '|' + entryPrice + '|' + sizeX + '|' + createdAtE3 + '|' + side + '|' + leverageE2 + '|' + isIsolated + '|' + transactTimeE3 + stopLossPrice + '|' + takeProfitPrice + '|' + orderCostE8 + '|' + reCalcEntryPrice + '|' + positionEntryPrice + '|' + positionCycleVersion + '|' + crossSeq + '|' + closeFreeQtyX + '|' + minPositionCostE8 + '|' + positionBalanceE8 + '|' + traderID + '|' + leaderFollowerCount + '|' + traderName;

  return crypto.createHash('md5').update(data).digest('hex');
}

export const generateRandomUUID = () => {
  return crypto.randomUUID()
}