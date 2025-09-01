import { Kafka } from "kafkajs";
import bs58 from "bs58";
import { loadProto } from "bitquery-protobuf-schema";
import pkg from "kafkajs";
import LZ4 from "kafkajs-lz4";
import { v4 as uuidv4 } from "uuid";
import { buyViaLaunchpad, sellTokenViaLaunchpad } from "./executeTrade.js";
const { CompressionTypes, CompressionCodecs } = pkg;
CompressionCodecs[CompressionTypes.LZ4] = new LZ4().codec;
const username = process.env.KAFKA_USERNAME;
const password = process.env.KAFKA_PASSWORD;
const topic = "bsc.tokens.proto";
const id = uuidv4();
const kafka = new Kafka({
  clientId: username,
  brokers: [
    "rpk0.bitquery.io:9092",
    "rpk1.bitquery.io:9092",
    "rpk2.bitquery.io:9092",
  ],
  sasl: {
    mechanism: "scram-sha-512",
    username: username,
    password: password,
  },
});

const consumer = kafka.consumer({ groupId: username + "-" + id });

const convertBytes = (value, encoding = "hex") => {
  if (encoding === "base58") {
    return bs58.default.encode(value);
  }
  return value?.toString("hex");
};

let ParsedMessage = await loadProto(topic); // Load proto before starting Kafka
await consumer.connect();
await consumer.subscribe({ topic, fromBeginning: false });
const seenTokens = new Set(); // Track processed token addresses

class buysell {
  async main() {
    await consumer.run({
      autoCommit: false,
      eachMessage: async ({ message }) => {
        try {
          // Getting Transfers
          const buffer = message.value;
          const decoded = ParsedMessage.decode(buffer);
          const msgObj = ParsedMessage.toObject(decoded, { bytes: Buffer });
          const transfers = msgObj.Transfers;
          // Iterating Transfers
          for (let i in transfers) {
            const transfer = transfers[i];
            const to = `0x${convertBytes(transfer.TransactionHeader.To)}`;
            const sender = `0x${convertBytes(transfer.Sender)}`;
            const tokenAddr = `0x${convertBytes(
              transfer.Currency.SmartContract
            )}`;
            const name = transfer.Currency.Name;
            const symbol = transfer.Currency.Symbol;
            // Checking the conditions implying Four Meme Token Creation using the DEX Address
            if (
              to == "0x5c952063c7fc8610ffdb798152d69f0b9550762b" &&
              sender == "0x0000000000000000000000000000000000000000"
            ) {
              // Checking if the token is already seen and updating the list of seen tokens if the token is new
              if (!seenTokens.has(tokenAddr)) {
                seenTokens.add(tokenAddr);
                console.log(`🚀 New Token: ${tokenAddr}, ${name} (${symbol})`);

                // Buying the token
                const buyReceipt = await buyViaLaunchpad(
                  tokenAddr,
                  "0.001",
                  0n
                );
                if (buyReceipt) {
                  // Schedule Sell in 60 seconds
                  setTimeout(async () => {
                    try {
                      await sellTokenViaLaunchpad(tokenAddr);
                    } catch (e) {
                      console.error(
                        `❌ Sell error for ${tokenAddr}:`,
                        e.reason || e.message || e
                      );
                    }
                  }, 60 * 1000);
                }
              }
            }
          }
        } catch (err) {
          console.error("Error decoding Protobuf message:", err);
        }
      },
    });
  }
}

export default buysell;