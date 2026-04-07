const { jwtVerify, createRemoteJWKSet } = require("jose");
const HttpError = require("../models/http-error");

const IAM_BASE_URL = process.env.IAM_BASE_URL || "http://localhost:3001";
const IAM_JWKS_URL = process.env.IAM_JWKS_URL || `${IAM_BASE_URL.replace(/\/+$/, "")}/oauth/jwks`;
const IAM_ISSUER = process.env.IAM_ISSUER || IAM_BASE_URL;
const IAM_AUDIENCE = process.env.IAM_AUDIENCE || "ppg-cikampek-apps";

const JWKS = createRemoteJWKSet(new URL(IAM_JWKS_URL));

module.exports = async (req, res, next) => {
    try {
        if (req.method === "OPTIONS") return next();

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new Error("No token");
        }

        const token = authHeader.split(" ")[1];
        if (!token) throw new Error("No token");

        const { payload } = await jwtVerify(token, JWKS, {
            issuer: IAM_ISSUER,
            audience: IAM_AUDIENCE,
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
