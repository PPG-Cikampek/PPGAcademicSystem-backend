const mongoose = require('mongoose');
const validator = require('validator');
const HttpError = require('./http-error');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: { type: String, required: true },
    email: {
        type: String,
        required: [true, 'Masukkan Email!'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'Masukkan Email yang Valid!']
    },
    isEmailVerified: { type: Boolean, required: true, default: false },
    password: { type: String, required: true, minlength: [8, 'Password must be at least 8 characters'] },
    role: { type: String, required: true },
    image: { type: String, required: false },
    thumbnail: { type: String, required: false },
    subBranchId: { type: mongoose.Types.ObjectId, required: false, ref: 'SubBranch' },
    resetToken: { type: String },
    resetTokenExpiration: { type: Date }
});

userSchema.pre('save', async function(next) {
    const user = this;
    try {
        await user.validate();
        next();
    } catch (err) {
        console.log("AdaERRRORR" + err);
        next(new HttpError(err.message, 400));
    }
});

module.exports = mongoose.model('User', userSchema);

