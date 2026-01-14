const mongoose = require('mongoose');

const Schema = mongoose.Schema;

/**
 * Counter for generating auto-incrementing bug report IDs.
 * Similar to nisCounter.js pattern.
 * Format: BUG-XXXXXX (e.g., BUG-000001)
 */
const reportIdCounterSchema = new Schema({
    _id: { type: String, required: true }, // 'bugReportId'
    seq: { type: Number, default: 0 }
});

/**
 * Get the next report ID in sequence.
 * Uses findOneAndUpdate for atomic increment.
 * @returns {Promise<string>} The next report ID (e.g., 'BUG-000001')
 */
reportIdCounterSchema.statics.getNextReportId = async function() {
    const counter = await this.findOneAndUpdate(
        { _id: 'bugReportId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    
    // Format as BUG-XXXXXX with leading zeros
    const paddedSeq = String(counter.seq).padStart(6, '0');
    return `BUG-${paddedSeq}`;
};

module.exports = mongoose.model('ReportIdCounter', reportIdCounterSchema);
