import { PubSub } from "@google-cloud/pubsub";

export class PubSubClient {
  constructor(keyFilePath) {
    this.client = new PubSub({
      keyFile: keyFilePath
    });
  }

  async getTopic(topic_name) {
    return this.client.topic(topic_name)
  }

  async getAllTopics() {
    const [topics] = await this.client.getTopics();
    return topics
  }

  async publishJsonMessageToTopic(topic_name, data) {
    const client = this.client;
    const topic = client.topic(topic_name)
    const messageId = await topic.publishMessage({ json: data })
    console.log(`Message with id: ${messageId} published!`);
  }

  async createTopic(topic_name) {
    const client = this.client;
    return client.createTopic(topic_name)
  }
}