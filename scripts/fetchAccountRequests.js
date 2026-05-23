const mongoose = require("mongoose");
require("dotenv").config();

const AccountRequest = require("../models/accountRequest");

const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

const TARGET_USER_ID = "6853a3b404ccac9a7b9862eb";
const OUTPUT_FILE = __dirname + "/output/account_requests.csv";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const userId = new mongoose.Types.ObjectId(TARGET_USER_ID);

  const results = await AccountRequest.aggregate([
    { $match: { userId } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$accountList", preserveNullAndEmptyArrays: false } },
    { $sort: { createdTime: -1 } },
    {
      $project: {
        _id: 0,
        userId: { $toString: "$userId" },
        userName: "$user.name",
        accountName: "$accountList.name",
        accountType: "$accountList.accountRole",
        requestedDate: {
          $dateToString: { format: "%Y-%m-%d %H:%M:%S", date: "$createdTime" },
        },
        status: 1,
      },
    },
  ]);

  const fs = require("fs");
  const header = "userID,user name,account name,account type,requested date,status";
  const rows = results.map((r) =>
    [
      r.userId,
      `"${(r.userName || "").replace(/"/g, '""')}"`,
      `"${(r.accountName || "").replace(/"/g, '""')}"`,
      r.accountType || "",
      r.requestedDate || "",
      r.status || "",
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");

  fs.mkdirSync(__dirname + "/output", { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, csv, "utf-8");

  console.log(`Found ${results.length} account entries`);
  console.log(`CSV written to ${OUTPUT_FILE}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
