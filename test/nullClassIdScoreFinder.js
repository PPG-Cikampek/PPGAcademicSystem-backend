// Add this temporarily to your controller or run in a Node REPL connected to your DB
const mongoose = require('mongoose');
require('dotenv').config();

const Score = require('../models/score');
// Ensure Class model is registered (not strictly necessary but explicit)
require('../models/class');

// MongoDB client options (match app.js scripts)
const clientOptions = { serverApi: { version: "1", strict: true, deprecationErrors: true } };
const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

(async function main() {
  if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error('Missing DB credentials in environment (.env). Please set DB_USER, DB_PASSWORD and DB_NAME.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI, clientOptions);
    console.log('✅ Connected to MongoDB');

    const scores = await Score.find({
      branchYearId: '6937f1695e57d4171fd077dc',
      subBranchId: '6853914847edac295bb85044',
    })
      .select('_id classId studentId')
      .lean();

    console.log('\n=== Checking for orphaned classIds ===');
    if (!scores || scores.length === 0) {
      console.log('No scores found for given branchYearId and subBranchId');
    }

    for (const score of scores) {
      if (score.classId) {
        const classExists = await mongoose.model('Class').findById(score.classId).lean();
        if (!classExists) {
          console.log(`❌ ORPHANED - Score ${score._id} references missing classId: ${score.classId}`);
        }
      } else {
        console.log(`⚠️  NULL - Score ${score._id} has null classId`);
      }
    }
  } catch (err) {
    console.error('Error while running script:', err);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    } catch (e) {
      console.error('Error disconnecting mongoose:', e);
    }
  }
})();