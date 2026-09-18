

const reqRateLimiter = (capacity, refillRate, refillIntervals, identifier) => {

    if (!capacity) {
        throw new Error("CAPACITY_MISSING");
    }

    if (!refillRate) {
        throw new Error("REFILL_RATE_MISSING");
    }

    if (!refillIntervals) {
        throw new Error("REFILL_INTERVALS_MISSING");
    }
    
    if (!identifier) {
        throw new Error("IDENTIFIER_MISSING");
    }

    if (typeof capacity !== 'number') {
        throw new Error("INVALID_CAPACITY_DATA_TYPE \n CAPACITY_MUST_BE_A_NUMBER");
    }

    if (typeof refillRate !== 'number') {
        throw new Error("INVALID_REFILL_RATE_DATA_TYPE \n REFILL_RATE_MUST_BE_A_NUMBER");
    }

    if (typeof refillIntervals !== 'number') {
        throw new Error("INVALID_REFILL_INTERVALS_DATA_TYPE \n REFILL_INTERVALS_MUST_BE_A_NUMBER");
    }
    
    if (typeof identifier !== 'string') {
        throw new Error("INVALID_IDENTIFIER_DATA_TYPE \n IDENTIFIER_MUST_BE_A_STRING");
    }

    const buckets = new Map();

    return (req, res, next) => {

        const requestPattern = req[identifier];

        let bucket = buckets.get(requestPattern);

        if (!bucket) {
            bucket = { tokens: capacity, lastRefillTimestamp: Date.now() };
            buckets.set(requestPattern, bucket);
        }

        const now = Date.now();

        const timeElapsed = now - bucket.lastRefillTimestamp;

        const tokensEarned = (timeElapsed / refillIntervals) * refillRate;

        bucket.tokens = Math.min(capacity, bucket.tokens + tokensEarned);

        bucket.lastRefillTimestamp = now;

        if (bucket.tokens < 1) {
            return res.status(429).json({ message: 'TOO_MANY_REQUESTS' })
        }

        bucket.tokens -= 1;

        next();
    }

}

module.exports = reqRateLimiter;