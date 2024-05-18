import mysql from 'mysql2/promise';
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { dbConfig } from '../config.js';
import { PubSubClient } from './pub_sub_client.js';
import { generateRandomUUID } from '../../bybit/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const makeConnectionToDB = async () => {
  const pool = mysql.createPool(dbConfig)
  return await pool.getConnection();
}

function extractLiveTradeMessage(row) {
  const id = generateRandomUUID()
  const { symbol, entryPrice, sizeX, leverageE2, positionBalanceE8, traderID, leaderFollowerCount, startTime } = row;
  const messageToPublish = { id, symbol, entryPrice, size: sizeX, leverageE2, positionBalanceE8, traderID, leaderFollowerCount, startTime }
  return messageToPublish
}

function extractClosedTrade(row) {
  const id = generateRandomUUID()
  const { symbol, entryPrice, sizeX, leverageE2, positionBalanceE8, traderID, leaderFollowerCount, startTime, closePrice, closeStatus, closedTime } = row;
  const messageToPublish = { id, symbol, entryPrice, sizeX, leverageE2, positionBalanceE8, traderID, leaderFollowerCount, startTime, closePrice, closeStatus, closedTime }
  return messageToPublish;
}

export async function publishLiveTrades(time) {
  const pubsub = new PubSubClient('/root/crypto-price-prediction-cred.json');
  const db = await makeConnectionToDB()
  const [rows, meta] = await db.execute(`select * from live_trades where createdAt > ?`, [time])
  const live_trade_topic = await pubsub.getTopic('live_trades_topic');
  rows.map(async row => {
    const message = extractLiveTradeMessage(row)
    const messageId = await live_trade_topic.publishMessage({ json: message })
    console.log(`Published live trade with messageId: ${messageId}`)
  })
  db.release();
}

export async function publishClosedTrades(time) {
  const pubsub = new PubSubClient('/root/crypto-price-prediction-cred.json');
  const db = await makeConnectionToDB()
  const [rows, meta] = await db.execute(`select * from live_trades where isClosed = true and updatedAt > ?`, [time]);
  const closed_trades_topic = await pubsub.getTopic('closed_trades_topic');
  rows.map(async row => {
    const message = extractClosedTrade(row)
    const messageId = await closed_trades_topic.publishMessage({ json: message })
    console.log(`Published closed trade with messageId: ${messageId}`)
  })
  db.release();
}

const constructSelectStatement = async (table_name, db) => {
  try {
    const [columns] = await db.execute(`DESCRIBE ${table_name}`)
    let result = columns.reduce((acc, curr) => {
      return acc += curr['Field'] + ' ,';
    }, "")
    result = result.slice(0, -1)
    // console.log(result)
    return result;
  } catch (error) {
    console.log(error)
  }
}
let hashMap = {}

const checkUniqueness = (hash, id) => {
  if (hashMap[hash] === undefined) hashMap[hash] = { count: 1, ids: [id] };
  else {
    const obj_ref = hashMap[hash];
    obj_ref.count++
    obj_ref.ids.push(id)
  }
}

const deleteDuplicates = async (table_name, db) => {
  try {
    for (let dup of dupData) {
      const { count, ids } = dup;
      if (count > 1) {
        // console.log(`${table_name}: dup ids: ${JSON.stringify(ids)}\n`)
        const dupIds = ids.slice(1);
        const condition = constructWhere(dupIds)
        const deleteStatement = `delete from ${table_name} where ${condition}`
        // console.log(`${table_name}: ids getting deleted: ${JSON.stringify(dupIds)} \n Using delete statement ${deleteStatement} values: ${JSON.stringify(dupIds)}\n`)
        await db.execute(deleteStatement, dupIds)
      }
    }
  } catch (error) {
    console.log('Error while deleting dups', error);
  }
}

export async function removeDuplicateLiveTrades() {
  let db
  try {
    db = await makeConnectionToDB();
    const table_name = 'live_trades';
    const select = await constructSelectStatement(table_name, db)
    const limit = 100000;
    let offset = 0;
    let hasMoreRows = true;
    let totalUniques = 0;
    while (hasMoreRows) {
      console.log({ limit, offset })
      hashMap = {}
      const [res, meta] = await db.query(`SELECT ${select} FROM ${table_name} LIMIT ?, ?`, [offset, limit]);
      if (res.length === 0) {
        hasMoreRows = false
        break;
      }
      res.map((row) => {
        const id = row['id'];
        delete row['id'];
        delete row['createdAt']
        delete row['updatedAt']
        const data = Object.values(row).join(",");
        checkUniqueness(data, id);
      })
      totalUniques += Object.keys(hashMap).length;
      await deleteDuplicates(table_name, db)
      offset += limit;
    }
    console.log("Duplication check ended successfully");
  } catch (error) {
    console.log("Duplication check failed", error);
  }
   db.release()
}

export async function removeDuplicateCloseTrades() {
  let db;
  try {
    db = await makeConnectionToDB();
    const table_name = 'closed_trades';
    const select = await constructSelectStatement(table_name, db)
    const limit = 100000;
    let offset = 0;
    let hasMoreRows = true;
    while (hasMoreRows) {
      console.log({ limit, offset })
      hashMap = {}
      const [res, meta] = await db.query(`SELECT ${select} FROM ${table_name} LIMIT ?, ?`, [offset, limit]);
      if (res.length === 0) {
        hasMoreRows = false
        break;
      }
      res.map((row) => {
        const id = row['id'];
        delete row['id'];
        const data = Object.values(row).join(",");
        checkUniqueness(data, id);
      })
      await deleteDuplicates(table_name, db)
      offset += limit;
    }
    console.log("Duplication check ended successfully");
  } catch (error) {
    console.log("Duplication check failed", error);
  }
  db.release()
}
