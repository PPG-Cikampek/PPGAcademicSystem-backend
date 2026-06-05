const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB:", process.env.DB_NAME);

  const db = mongoose.connection.db;

  const pipeline = [
    {
      $match: {
        role: { $in: ["branchAdmin", "subBranchAdmin"] },
        email: { $not: { $regex: "@ppgcikampek\\.id$", $options: "i" } },
      },
    },
    {
      $lookup: {
        from: "subbranches",
        localField: "subBranchId",
        foreignField: "_id",
        as: "subBranch",
      },
    },
    { $unwind: { path: "$subBranch", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "branches",
        localField: "subBranch.branchId",
        foreignField: "_id",
        as: "branch",
      },
    },
    { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$branch.name", "No Branch"] },
        users: {
          $push: {
            name: "$name",
            role: "$role",
            subBranch: { $ifNull: ["$subBranch.name", "-"] },
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const results = await db.collection("users").aggregate(pipeline).toArray();

  const total = results.reduce((sum, r) => sum + r.users.length, 0);

  let grandDesa = 0;
  let grandKelompok = 0;

  results.forEach((r) => {
    const desa = r.users.filter((u) => u.role === "branchAdmin");
    const kelompok = r.users.filter((u) => u.role === "subBranchAdmin");

    const kelompokBySub = {};
    kelompok.forEach((u) => {
      if (!kelompokBySub[u.subBranch]) kelompokBySub[u.subBranch] = [];
      kelompokBySub[u.subBranch].push(u.name);
    });

    console.log(r._id);
    if (desa.length) {
      console.log(`    PJP Desa: ${desa.map((u) => u.name).join(", ")}`);
    }
    for (const [sub, names] of Object.entries(kelompokBySub).sort((a, b) => a[0].localeCompare(b[0]))) {
      const label = `    PJP Kelompok ${sub}: `;
      const pad = " ".repeat(label.length);
      const lines = names.map((n, i) => (i === 0 ? `${label}${n}` : `${pad}${n}`));
      console.log(lines.join("\n"));
    }
    console.log(`PJP Desa: ${desa.length}`);
    console.log(`PJP Kelompok: ${kelompok.length}`);
    console.log(`Total: ${r.users.length}`);
    console.log();

    grandDesa += desa.length;
    grandKelompok += kelompok.length;
  });

  console.log(`Total PJP Desa: ${grandDesa}`);
  console.log(`Total PJP Kelompok: ${grandKelompok}`);
  console.log(`Total: ${grandDesa + grandKelompok}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
