const jwt = require('jsonwebtoken');

const jwtHandler = (secret) => {

    if (!secret) {
        throw new Error("SECRET_ARGUEMENT_IS_MISSING");
    }

    if (typeof secret !== "string") {
        throw new Error("INVALID_SECRET_TYPE");
    }

    return (req, res, next) => {

        const authHeader = req.headers.authorization?.split(' ')[1];

        const cookieHeader = req.headers.cookie?.split('=')[1];

        const token = authHeader || cookieHeader;

        if (!token) {
            return res.status(401).json({ message: 'MISSING_TOKEN' });
        }

        let decodedToken;

        try {

            decodedToken = jwt.verify(token, secret);

        } catch (error) {
            return res.status(401).json({ message: 'INVALID_TOKEN' });
        }

        req.user = decodedToken;

        next();

    }
}

module.exports = jwtHandler;