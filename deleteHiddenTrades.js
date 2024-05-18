import fs from "fs";
import axios from "axios";
import utf8 from 'utf8';
import querystring from 'querystring';
import mysql from 'mysql2'; // Import the mysql2 library
import { close, init, get } from "./fetcher.js"
import { dbConfig } from "./config.js"

const maxRetries = 5; // Maximum number of retry attempts
const retryInterval = 1000; // Time in milliseconds to wait between retries


const baseUrl = 'https://api2.bybit.com/fapi/beehive/public/v1/common/dynamic-leader-list';
const pageSize = 50;
const dataDuration = 'DATA_DURATION_SEVEN_DAY';

const outputFileName = 'master-traders.json';
const totalPageCount = 175; // Set the total page count here
const timeStamp = Date.now(); // Replace with your desired timestamp

// MySQL database configuration

const connection = mysql.createConnection(dbConfig);



const main = async () => {
  await init()
  try {    
    connection.connect(); // Connect to the database
      deleteHiddenTraderRecords();

  } catch (error) {
    console.error('An error occurred:', error.message);
  }
  await close()
}

// Function to delete trades of the hidden traders from the MySQL database
function deleteHiddenTraderRecords() {

  console.log("deleting hidden trades");
  const query = 'delete from live_trades where traderID in (select trader_id from master_traders where is_trade_open = 1);';
  
  connection.query(query, (err) => {
    if (err) {
      console.error('Error deleting hidden records from the database:', err);
    } else {
      console.log('Data deleted successfully.');
    }
    connection.close(); // Close the database connection
    return;
  });
}

export default main
main()
