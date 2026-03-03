const { jwtVerify } = require("jose");
const HttpError = require("../models/http-error");

const iamSecret = new TextEncoder().encode(process.env.IAM_JWT_SECRET);

module.exports = async (req, res, next) => {
    try {
        if (req.method === "OPTIONS") return next();

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new Error("No token");
        }

        const token = authHeader.split(" ")[1];
        if (!token) throw new Error("No token");

        const { payload } = await jwtVerify(token, iamSecret, {
            issuer: "iam.ppgcikampek.id",
            audience: "ppg-cikampek-apps",
        });

        req.userData = {
            userId: payload.userId,
            userRole: payload.role,
            userBranchId: payload.branchId,
            userSubBranchId: payload.subBranchId,
        };
        next();
    } catch (err) {
        return next(new HttpError("Authentication Failed!", 401));
    }
};
