const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const branchSchema = new Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    subBranches: [{ type: mongoose.Types.ObjectId, required: false, ref: 'SubBranch' }],
    branchYears: [{ type: mongoose.Types.ObjectId, required: false, ref: 'BranchYear' }]
});


module.exports = mongoose.model('Branch', branchSchema);

