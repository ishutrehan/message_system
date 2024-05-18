import { PubSubClient } from "./pub_sub_client.js";
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const keyFilePath = path.join(__dirname, '..', '..', 'crypto-price-prediction-cred.json') // Absolute_path :- /root/crypto-price-prediction-cred.json

const pubsub = new PubSubClient(keyFilePath)

async function test() {
  const result = await pubsub.getAllTopics()
  result.map(topic => {
    console.log(topic.name)
  })
  // console.log(result)
  // const topic = await pubsub.createTopic('test');
  // const topic = await pubsub.getTopic('test');
  // console.log(topic);
  // const [subs] = await topic.createSubscription('test-sub');
  // const [sub_res] = await topic.getSubscriptions()
  // const [subs] = sub_res;
  // console.log(subs)
  // subs.on('message', (message) => {
  //   console.log(message)
  // })
  // const messageId = await topic.publishMessage({ json: { testMessage2: 'message text!' } })
  // console.log(`message with id: ${messageId} is published!`);
  // console.log(`Topic: ${topic?.name} created!`);
  // const buffer = Buffer.from(JSON.stringify({ testMessage: 'message text' }));
  // const messageId = await topic.publishMessage({data: buffer})
  
  // const messageId = await topic.publishMessage({ data: buffer });
}

// test();
// console.log('dirname', __dirname)
// console.log({
//   keyFilePath
// })