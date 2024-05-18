import fs from "fs";
import axios from "axios";
import utf8 from 'utf8';
import querystring from 'querystring';
import mysql from 'mysql2'; // Import the mysql2 library
import { close, init, get } from "./fetcher.js"
import { dbConfig } from "./config.js"

const maxRetries = 5; // Maximum number of retry attempts
const retryInterval = 1000; // Time in milliseconds to wait between retries


const baseUrl = 'https://api2.bybit.com/fapi/beehive/public/v1/common/leader-history';
const pageSize = 50;
const dataDuration = 'DATA_DURATION_SEVEN_DAY';

const outputFileName = 'master-traders.json';
const timeStamp = Date.now(); // Replace with your desired timestamp

// MySQL database configuration

const pool = mysql.createPool(dbConfig);

const callApiWithRetry = async (retryCount = 0) => {
  try {
    for (let t = 2810; t < 5000; t++) {
      let trader = traders[t];
      let pageNo = 1;
      let x = 0;
      let totalPageCount = 1; // Set the total page count here
      let liveTradesRaw = []
      console.log("fetched data for trader: ", trader['trader_id']);
      let pageType = "first_page";
      for (let pageNo = 1; pageNo <= totalPageCount; pageNo++) {
        
        const url = `${baseUrl}?pageAction=${pageType}&pageSize=50&timeStamp=${timeStamp}&leaderMark=${trader['trader_id']}`;
        const response = await get(url)
        pageType = "next";
        if (response.status === 200) {
          if (response.data.result.data.length > 0 && response.data.result.data[x]["closedTimeE3"] > 1712019660000) {
            console.log(response.data.result.data[x]["closedTimeE3"])
            x = x + 50;
            console.log("total pages: ", totalPageCount);
            console.log("total data count: ", response.data.result.totalCount);
            totalPageCount = Math.ceil((response.data.result.totalCount) / pageSize);
            liveTradesRaw = [...liveTradesRaw, ...response.data.result.data]
            console.log("data size: ", response.data.result.data.length);
            console.log("total array size: ", liveTradesRaw.length);
            console.log(`Fetched data for page ${pageNo}`);
          }
          if (response.data.result.data.length < 50) {
            console.log("no data");
            break
          }
        } else {
          console.error(`Received a ${response.status} response for page ${pageNo}. Retrying...`);
        }
      }
      let liveTrades = liveTradesRaw.map(s => {
        s.traderID = trader['trader_id'];
        s.traderName = trader['trader_name'];
        s.leaderFollowerCount = trader['follower_count'];
        s.closePrice = s.closedPrice;
        s.closeStatus = "Correct";
        s.createdAtE3 = s.startedTimeE3;
        return s;
      })
      if (liveTrades.length > 0) {
        console.log("called insert: ", t + 1);
        await insertTrades(liveTrades);
      }
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
  }

  return "success";
};

async function insertTrades(rows) {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.log('query connec error!', err);
        reject(err);
      } else {
        let data = rows.map(row => {
          let { closedTimeE3, closePrice, symbol, entryPrice, size, createdAtE3, side, leverageE2, isIsolated, orderCostE8, positionEntryPrice, positionCycleVersion, crossSeq, traderID, leaderFollowerCount, traderName } = row;
          return [closedTimeE3, closePrice, symbol, entryPrice, size, createdAtE3, side, leverageE2, isIsolated, orderCostE8, positionEntryPrice, positionCycleVersion, crossSeq, traderID, leaderFollowerCount, traderName];
        })
        //isClosed = true, closePrice = ${closePrice}, closeStatus = "${closeStatus}", transactTimeE3
        const query = 'INSERT INTO old_trades (closedTimeE3, closePrice, symbol, entryPrice, size, createdAtE3, side, leverageE2, isIsolated, orderCostE8, positionEntryPrice, positionCycleVersion, crossSeq, traderID, leaderFollowerCount, traderName) VALUES ? ';
        const values = data;
        connection.query(query, [values], (err) => {
          connection.close();
          if (err) {
            console.log(err);
            reject(err);
          } else {
            console.log("************************ DATA INSERTED *************************************");
            resolve("Success");
            // Release the connection after the query execution
            connection.release();
          }

        });
      }
    })
  })
}

const fetchTradersFromDatabase = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.log('query connec error!', err);
        reject(err);
      } else {
        connection.query('SELECT * FROM master_traders where is_trade_open=0 and follower_count > 0 order by follower_count asc', (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }

        });
      }
    });
  });
};

let traders = [];
const main = async () => {
  let results = await Promise.all([
    await fetchTradersFromDatabase(),
    init()
  ])
  try {
    traders = results[0];
    console.log('Fetched all traders from DB');

    await callApiWithRetry(traders);

  } catch (error) {
    console.error('An error occurred:', error.message);
  }
  console.log("fetched data for all traders.");
  await close()
}

export default main
main()

