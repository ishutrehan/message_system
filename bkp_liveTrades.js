import winston from 'winston';
import winstonDaily from 'winston-daily-rotate-file';
import mysql from 'mysql2';
import { close, init, get } from "./fetcher.js"
import { dbConfig } from "./config.js"
import { PrismaClient, Prisma } from '@prisma/client'
import Xvfb from 'xvfb'
var xvfb = new Xvfb();
const prisma = new PrismaClient()


// MySQL database configuration

const pool = mysql.createPool(dbConfig);
// Define log format
const logFormat = winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`);

/*
 * Log Level
 * error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
 */
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    logFormat,
  ),
  transports: [
    // debug log setting
    new winstonDaily({
      level: 'debug',
      datePattern: 'YYYY-MM-DD',
      dirname: `./debug`, // log file /logs/debug/*.log in save
      filename: `%DATE%.log`,
      maxFiles: 300, // 30 Days saved
      json: false,
      zippedArchive: true,
      handleExceptions: false,
    }),
    // error log setting

    new winstonDaily({
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      dirname: `./error`, // log file /logs/error/*.log in save
      filename: `%DATE%.log`,
      maxFiles: 300, // 30 Days saved
      json: false,
      zippedArchive: true,
      handleExceptions: false,
    }),
  ],
});

logger.add(
  new winston.transports.Console({
    format: winston.format.combine(winston.format.splat(), winston.format.colorize()),
  }),
);



const baseUrl = 'https://api2.bybit.com/fapi/beehive/public/v1/common/order/list-detail';
const timeStamp = Date.now(); // Replace with your desired timestamp

let replaceQueue = []

async function doTrader(trader, lastTrade) {
  let liveTradesRaw = []

  for (let pageNo = 1; pageNo < 9999; pageNo++) {
    const url = `${baseUrl}?timeStamp=${timeStamp}&page=${pageNo}&pageSize=50&leaderMark=${trader['trader_id']}`;
    const response = await get(url);
    if (response.data.retMsg !== 'success') {
      debugger
    }
    let { totalCount, currentPage, data, openTradeInfoProtection } = response.data.result

	if (Number(totalCount) === 0) {
      if (openTradeInfoProtection === 1) {
        updateTrader(trader['trader_id']);        
      }
      return      
    }
    liveTradesRaw = [...liveTradesRaw, ...response.data.result.data]
    if (data.length < 50) break

  }

  let liveTrades = liveTradesRaw.map(s => {
    s.traderID = trader['trader_id'];
    s.traderName = trader['trader_name'];
    s.leaderFollowerCount = trader['follower_count'];
    return s;
  })

  console.log(`${liveTrades.length} live trades found`)

  for(let trade of liveTrades){
    if(!replaceQueue.find(row => row.crossSeq === trade.crossSeq)){
      replaceQueue.push(trade)
    }
  }

  // replaceQueue = [...replaceQueue, ...liveTrades]

  // insert them here in a non-blocking way
}

const callApiWithRetry = async (retryCount = 0, pageNo) => {
  let queue = []

  // get the last trades first so there's nothing blocking the queue
  let lastTrades = await query(`select * from live_trades where id in (SELECT MAX( ID ) FROM live_trades GROUP BY traderID)`)

  for (let t = 0; t < 10000; t++) {
    queue.push(traders[t]) 
  }

  async function processQueue() {
    let trader
    while (trader = queue.shift()) {
      await doTrader(trader, lastTrades.find(trade => trade.traderID === trader.trader_id) || {})
      console.log(queue.length)
    }
  }

  await Promise.all([
    processQueue(),
    processQueue(),
    processQueue(),
    processQueue(),
    processQueue(),
    processQueue(),
    processQueue(),
    processQueue(),
   // processQueue(),
  //  processQueue(),
  ])

  console.log(`found ${replaceQueue.length} to insert...`)
await insertTrades(replaceQueue).then(() => console.log("insert success!")).catch(e => console.warn(`Insert oops! ${e.message}`))
  await updateTrades(replaceQueue).then(() => console.log("update success!")).catch(e => console.warn(`Update oops! ${e.message}`))
}

async function sleep(time = 1) {
  const sleepMilliseconds = time

  return new Promise(resolve => {
    setTimeout(() => {
      resolve(`Slept for: ${sleepMilliseconds}ms`)
    }, sleepMilliseconds)
  })
}

const fetchTradesFromDatabase = (traderID) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.log('query connec error!', err);
        reject(err);
      } else {
        connection.query(`SELECT * FROM live_trades where traderID = '${traderID}'`, (err, results) => {
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

const fetchTradersFromDatabase = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.log('query connec error!', err);
        reject(err);
      } else {
        connection.query('SELECT * FROM master_traders where is_trade_open=0 and follower_count > 0', (err, results) => {
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

// Function to insert liveTrades data into the MySQL database
// const insertLiveTradesIntoDatabase = (liveTrades) => {
//   return new Promise((resolve, reject) => {
//     const query = 'INSERT INTO live_trades (symbol,entryPrice,size,createdAtE3,side,leverageE2,isIsolated,transactTimeE3,stopLossPrice,takeProfitPrice,orderCostE8,reCalcEntryPrice,positionEntryPrice,positionCycleVersion,crossSeq,closeFreeQtyX,minPositionCostE8,positionBalanceE8,traderID,leaderFollowerCount) VALUES ?';
//     const values = liveTrades.map((trade) => [
//       trade.symbol,
//       trade.entryPrice,
//       trade.sizeX,
//       trade.createdAtE3,
//       trade.side,
//       trade.leverageE2,
//       trade.isIsolated,
//       trade.transactTimeE3,
//       trade.stopLossPrice,
//       trade.takeProfitPrice,
//       trade.orderCostE8,
//       trade.reCalcEntryPrice,
//       trade.positionEntryPrice,
//       trade.positionCycleVersion,
//       trade.crossSeq,
//       trade.closeFreeQtyX,
//       trade.minPositionCostE8,
//       trade.positionBalanceE8,
//       trade.traderID,
//       trade.leaderFollowerCount
//     ]);
//     pool.getConnection((err, connection) => {
//       if (err) {
//         console.log("error");
//         reject(err)
//       } else {
//         connection.query(query, [values], (err) => {
//           if (err) {
//             reject(err);
//           } else {
//             resolve();
//           }
//         });
//       }
//     });
//   });
// };

const updateClosedTradesIntoDatabase = async (closedTrades) => {

  if (closedTrades.length > 0) {
    try {
      for (const trade of closedTrades) {
        pool.execute(
          `UPDATE live_trades SET isClosed = 1 WHERE traderId = '${trade.traderID}' AND crossSeq = ?`,
          [trade.crossSeq]
        );

      }
      console.log(`As per the API, Trade closed into the database successfully.`);
      logger.info(`As per the API, Trade closed into the database successfully.`);
    } catch (error) {
      console.error('Error updating trade objects:', error);
    }
  }
}

// query the db
function query(sql) {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.log('query connec error!', err);
        reject(err);
      } else {
        connection.query(sql, (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      }
    })
  })
}


// Function to insert data into the MySQL database
function updateTrader(traderID) {
  pool.getConnection((err, connection) => {
    const query = `UPDATE master_traders set is_trade_open = 1 where trader_id = '${traderID}'`;
    connection.query(query, (err) => {
      if (err) {
        console.error('Error inserting data into the database:', err);
        logger.error(`Error inserting data into the database: ${err}`);
      } else {
        console.log(`Data updated for ${traderID} into the database successfully.`);
        logger.info(`Data updated for ${traderID} into the database successfully.`);
      }
	    // Release the connection after the query execution
      connection.release();
    });
  });
}

let traders = [];
let existingTrades = [];

async function insertTrades(rows) {
  console.log(`searching for new rows`)

  existingTrades = await prisma.live_trades.findMany({
	  where: {}, select: {
      traderID: true, crossSeq: true    
    }
  })

  rows = rows.filter(row => !existingTrades.find(et => et.crossSeq === row.crossSeq))

  console.log(`${rows.length} new rows found`)

  return new Promise((resolve, reject) => {

    pool.getConnection((err, connection) => {
      if (err) {
        console.log('query connec error!', err);
        reject(err);
      } else {
        let data = rows.map(row => {
		    let { symbol, entryPrice, sizeX, createdAtE3, side, leverageE2, isIsolated, transactTimeE3, stopLossPrice, takeProfitPrice, takeProfitOrderId, stopLossOrderId, orderCostE8, reCalcEntryPrice, positionEntryPrice, positionCycleVersion, crossSeq, closeFreeQtyX, minPositionCostE8, positionBalanceE8, traderID, leaderFollowerCount, traderName} = row;
		      return [symbol, entryPrice, sizeX, createdAtE3, side, leverageE2, isIsolated, transactTimeE3, stopLossPrice, takeProfitPrice, orderCostE8, reCalcEntryPrice, positionEntryPrice, positionCycleVersion, crossSeq, closeFreeQtyX, minPositionCostE8, positionBalanceE8, traderID, leaderFollowerCount, traderName];
        })

        const query = 'INSERT INTO live_trades (symbol, entryPrice, size, createdAtE3, side, leverageE2, isIsolated, transactTimeE3, stopLossPrice, takeProfitPrice, orderCostE8, reCalcEntryPrice, positionEntryPrice, positionCycleVersion, crossSeq, closeFreeQtyX, minPositionCostE8, positionBalanceE8, traderID, leaderFollowerCount, traderName) VALUES ? ';		      
        const values = data;        
        connection.query(query, [values], (err) => {          
          if (err) {
            reject(err)
          } else {            
            const query = `update live_trades set startTime = FROM_UNIXTIME(transactTimeE3/1000) WHERE isClosed = 0`;
            connection.query(query, (err) => {
              connection.close();
              if (err) {
                console.log("startTime updation error", err);
                reject(err)
              } else {
                console.log("startTime updated");                        
              }
            });            
            resolve("Success")
          }

        });
      }
    })
  })
}
async function updateTrades(rows) {
  existingTrades = await prisma.live_trades.findMany({
	  where: {isClosed: false}, select: {
		  traderID: true, crossSeq: true, symbol: true                
    }
  })
  console.log(`${existingTrades.length} DB rows found`)


  let oldRecords = existingTrades.filter(trade => !rows.find(r => r.crossSeq === trade.crossSeq ))
  console.log(`${oldRecords.length} needs update`);  
  
  return new Promise((resolve, reject) => {

    pool.getConnection((err, connection) => {
      if (err) {
        console.log('query connec error!', err);
        reject(err);
      } else {
        if(oldRecords.length > 0){
		      let query = '';
		      let updatesCompleted = 0;
          oldRecords.forEach(async row => {
            await sleep(100);
            //get current price from bybit and add it to the column
            let url = `https://api2.bybit.com/spot/v3/public/quote/ticker/price?symbol=${row.symbol}`;
            const response = await get(url)
            let closePrice = 0;
            let closeStatus = "Incorrect";
            if (response.status === 200) {
              closePrice = (response.data.result.price == undefined) ? null : response.data.result.price;
              closeStatus = (response.data.result.price == undefined) ? "Incorrect" : "Correct";
		          console.log("close status: ", closeStatus);
            }
            const closedTime = Date.now(); 
		        query= `UPDATE live_trades SET isClosed = true, closePrice = ${closePrice}, closeStatus = "${closeStatus}", closedTime = FROM_UNIXTIME(${closedTime}/1000) WHERE traderID = "${row.traderID}" AND crossSeq = "${row.crossSeq}";`;
            console.log(row.symbol);		  		  
			      connection.query(query, (err) => {
        	      		if (err) {
                			console.log("records updation error", err);
                			reject(err)
                    } else {
                      console.log("records updated");
                      updatesCompleted++;

                      if (updatesCompleted === oldRecords.length) {
                        // Resolve only after all updates are done
                        resolve("Success");
                      }
                    }
          	});
	        });            
        }else {
          // If there are no old records to update, release the connection
          connection.release();
          resolve("Success");
        }   
      }
    })
  })
}
const mainTrade = async () => {
  xvfb.startSync();

  // code that uses the virtual frame buffer here


  // do these together
  let results = await Promise.all([
    await fetchTradersFromDatabase(),
    init()
  ])

  try {
    traders = results[0]
    console.log('Fetched all traders from DB');
    logger.info(`Fetched all traders from DB`);
    await getLiveTrades();
  } catch (error) {
    console.error('An error occurred while fetching traders from the database:', error);
    logger.error(`An error occurred while fetching traders from the database: ${error}`);
  }
  await close()

  // we can process.exit() because pm2 will restart anyway
  console.log(`finished at ${new Date().toLocaleString()}`)
  xvfb.stopSync();

  process.exit()
};

const getLiveTrades = async () => {
  await callApiWithRetry()
  // try {
  //   const jsonDataArray = await callApiWithRetry();

  //   await sleep(1000);
  //   await mainTrade();
  // } catch (error) {
  //   console.error('An error occurred closing current request pool:', error.message);
  //   logger.error(`An error occurred closing current request pool: ${error.message}`);
  // } finally {
  //   //restarting the trade request
  //   await mainTrade();
  // }
};

export default mainTrade;
mainTrade()

// pm2 start trades_wrapper.sh
