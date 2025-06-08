const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const subBranchSchema = new Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    branchId: { type: mongoose.Types.ObjectId, required: true, ref: 'Branch', index: true },
});


module.exports = mongoose.model('SubBranch', subBranchSchema);

