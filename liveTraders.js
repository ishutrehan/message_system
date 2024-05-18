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
let totalPageCount = 175; // Set the total page count here
const timeStamp = Date.now(); // Replace with your desired timestamp

// MySQL database configuration

const connection = mysql.createConnection(dbConfig);

function base64Transform(s) {
  // Step 1: Decode the input string from Base64
  const decodedBytes = Buffer.from(s, 'base64');

  // Step 2: Encode the decoded bytes back to Base64
  const urlSafeEncodedBytes = Buffer.from(decodedBytes).toString('base64');

  // Step 3: Decode the bytes as a UTF-8 string
  const utf8String = utf8.decode(urlSafeEncodedBytes);

  // Step 4: URL-encode the resulting string
  const urlSafeEncodedString = querystring.escape(utf8String);

  // Return the final URL-safe, UTF-8 encoded, and URL-encoded string
  return urlSafeEncodedString;
}

const callApiWithRetry = async (retryCount = 0) => {
  let allData = [];

  try {
    for (let pageNo = 1; pageNo <= totalPageCount; pageNo++) {
      const url = `${baseUrl}?pageNo=${pageNo}&pageSize=50&dataDuration=${dataDuration}&timeStamp=${timeStamp}&isAvailableLeader=true`;
      const response = await get(url)
      // console.log(response.headers);
      if (response.status === 200) {
        totalPageCount = response.data.result.totalPageCount;
        // console.log(response.data.result.leaderDetails);
        let leaderIds = response.data.result.leaderDetails.map(s => {
          return [base64Transform(s.leaderMark), s.currentFollowerCount, s.nickName]
        });

        // console.log(response.data.result.res);
        allData = allData.concat(leaderIds);
        console.log(`Fetched data for page ${pageNo}`);
      } else {
        console.error(`Received a ${response.status} response for page ${pageNo}. Retrying...`);
        if (retryCount < maxRetries) {
          // Wait for a while before making the next request
          await new Promise(resolve => setTimeout(resolve, retryInterval));
          await callApiWithRetry(retryCount + 1);
        } else {
          console.log('Maximum number of retries reached. Exiting.');
        }
      }
    }
    return allData;
  } catch (error) {
    console.error('An error occurred:', error.message);
    if (retryCount < maxRetries) {
      // Wait for a while before making the next request
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      await callApiWithRetry(retryCount + 1);
    } else {
      console.log('Maximum number of retries reached. Exiting.');
    }
  }
};


const main = async () => {
  await init()
  try {
    const jsonDataArray = await callApiWithRetry();
    fs.writeFileSync(outputFileName, JSON.stringify(jsonDataArray, null, 2));
    console.log(`JSON data saved to ${outputFileName}`);
    // Insert data into the MySQL database
    if (jsonDataArray.length > 0) {
      connection.connect(); // Connect to the database
      insertDataIntoDatabase(jsonDataArray);
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
  await close()
}


// Function to insert data into the MySQL database
function insertDataIntoDatabase(data) {
  const query = 'REPLACE INTO master_traders (trader_id, follower_count, trader_name) VALUES ?';
  const values = data;

  connection.query(query, [values], (err) => {
    if (err) {
      console.error('Error inserting data into the database:', err);
    } else {
      console.log('Data inserted into the database successfully.');
    }
    connection.end(); // Close the database connection
  });
}

export default main
main()