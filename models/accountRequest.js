const mongoose = require('mongoose');
const validator = require('validator');
const HttpError = require('./http-error');
const Schema = mongoose.Schema;

const accountRequestSchema = new Schema({
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    subBranchId: { type: mongoose.Types.ObjectId, required: true, ref: 'SubBranch' },
    ticketId: { type: String, required: true },
    createdTime: { type: Date, required: true },
    status: { type: String, required: true },
    accountList: { type: Array, required: true }
});


module.exports = mongoose.model('AccountRequest', accountRequestSchema);

