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
      deleteDupRecords();

  } catch (error) {
    console.error('An error occurred:', error.message);
  }
  await close()
}

// Function to delete duplicate trades from the MySQL database
function deleteDupRecords() {

  console.log("deleting hidden trades");

  for(let i=0;i<1000;i++){
    const query = 'DELETE from non_dup_trades ndt where crossSeq in (SELECT DISTINCT crossSeq from dup_val dv) limit 1000;';  
    connection.query(query, (err) => {
      if (err) {
        console.error('Error deleting hidden records from the database:', err);
      } else {
        console.log('1000 Data deleted successfully.');
      }  
    });
  }
}

export default main
main()

