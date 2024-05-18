import main from "./liveTraders.js";
import mainTrade from "./liveTrades.js";
import express from "express";
import { CronJob } from 'cron';

const app = express()
const PORT = 3000
let isJobRunning = false;

app.listen(PORT, () => {
  console.log(`API listening on PORT ${PORT} `)
})

const response = await mainTrade();

app.get('/traders', async (req, res) => {

  const data = await main();
  console.log(data);
  res.status(200).json({ status: "success", message: data })
})

