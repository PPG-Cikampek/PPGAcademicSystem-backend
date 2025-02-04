const jwt = require('jsonwebtoken');
const HttpError = require('../models/http-error')

module.exports = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        if (!token) {
            throw new Error('Invalid token!')
        }

        const decodedToken = jwt.verify(token, process.env.JWT_KEY);
        
        req.userData = { userId: decodedToken.userId, userRole: decodedToken.role };
        next()
    } catch (err) {
        console.log()
        return next(new HttpError('Authentication Failed!', 403))
    }

};
