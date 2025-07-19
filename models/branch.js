const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const branchSchema = new Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    subBranches: [{ type: mongoose.Types.ObjectId, required: false, ref: 'SubBranch' }],
    branchYears: [{ type: mongoose.Types.ObjectId, required: false, ref: 'BranchYear' }]
});

// Add indexes for better query performance
branchSchema.index({ name: 1 }); // Index on name field for faster name-based queries
// branchSchema.index({ address: 1 }); // Index on address field for location-based queries
// branchSchema.index({ name: 1, address: 1 }); // Compound index for combined queries

module.exports = mongoose.model('Branch', branchSchema);

