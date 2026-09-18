const reqRateLimiter = require('../src/reqRateLimiter');

const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

describe('reqRateLimiter factory validation', () => {
    test('throws if capacity is missing', () => {
        expect(() => reqRateLimiter(undefined, 1, 2000, 'ip')).toThrow('CAPACITY_MISSING');
    });

    test('throws if refillRate is missing', () => {
        expect(() => reqRateLimiter(5, undefined, 2000, 'ip')).toThrow('REFILL_RATE_MISSING');
    });

    test('throws if refillIntervals is missing', () => {
        expect(() => reqRateLimiter(5, 1, undefined, 'ip')).toThrow('REFILL_INTERVALS_MISSING');
    });

    test('throws if identifier is missing', () => {
        expect(() => reqRateLimiter(5, 1, 2000)).toThrow('IDENTIFIER_MISSING');
    });

    test('throws if capacity is not a number', () => {
        expect(() => reqRateLimiter('5', 1, 2000, 'ip')).toThrow('CAPACITY_MUST_BE_A_NUMBER');
    });

    test('throws if identifier is not a string', () => {
        expect(() => reqRateLimiter(5, 1, 2000, 42)).toThrow('IDENTIFIER_MUST_BE_A_STRING');
    });

    test('does not throw with valid arguments', () => {
        expect(() => reqRateLimiter(5, 1, 2000, 'ip')).not.toThrow();
    });
});

describe('reqRateLimiter middleware — token bucket behavior', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('allows exactly `capacity` requests in an instant burst, then rejects the next one', () => {
        const middleware = reqRateLimiter(5, 1, 2000, 'ip');
        const req = { ip: '1.2.3.4' };

        for (let i = 0; i < 5; i++) {
            const res = makeRes();
            const next = jest.fn();
            middleware(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
            expect(res.status).not.toHaveBeenCalled();
        }

        const res = makeRes();
        const next = jest.fn();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({ message: 'TOO_MANY_REQUESTS' });
        expect(next).not.toHaveBeenCalled();
    });

    test('refills tokens based on elapsed time, allowing exactly the earned amount afterward', () => {
        const middleware = reqRateLimiter(5, 1, 2000, 'ip');
        const req = { ip: '1.2.3.4' };

        // Drain the bucket completely (5 tokens, capacity 5).
        for (let i = 0; i < 5; i++) {
            middleware(req, makeRes(), jest.fn());
        }

        // Confirm it's actually empty right now.
        const drainedRes = makeRes();
        const drainedNext = jest.fn();
        middleware(req, drainedRes, drainedNext);
        expect(drainedRes.status).toHaveBeenCalledWith(429);
        expect(drainedNext).not.toHaveBeenCalled();

        // Advance the clock by 4000ms — at 1 token per 2000ms, that's exactly 2 tokens earned.
        jest.setSystemTime(4000);

        const firstRefilled = { res: makeRes(), next: jest.fn() };
        middleware(req, firstRefilled.res, firstRefilled.next);
        expect(firstRefilled.next).toHaveBeenCalledTimes(1);

        const secondRefilled = { res: makeRes(), next: jest.fn() };
        middleware(req, secondRefilled.res, secondRefilled.next);
        expect(secondRefilled.next).toHaveBeenCalledTimes(1);

        // A third request right after should be rejected — only 2 tokens had regenerated.
        const thirdRes = makeRes();
        const thirdNext = jest.fn();
        middleware(req, thirdRes, thirdNext);
        expect(thirdRes.status).toHaveBeenCalledWith(429);
        expect(thirdNext).not.toHaveBeenCalled();
    });

    test('never exceeds capacity even after a very long idle period', () => {
        const middleware = reqRateLimiter(5, 1, 2000, 'ip');
        const req = { ip: '1.2.3.4' };

        // One request to create the bucket, then let a huge amount of time pass.
        middleware(req, makeRes(), jest.fn());
        jest.setSystemTime(1000 * 60 * 60); // one hour later

        // Bucket should be capped at capacity (5), not some huge accumulated number —
        // so exactly 5 requests succeed, and the 6th does not.
        for (let i = 0; i < 5; i++) {
            const res = makeRes();
            const next = jest.fn();
            middleware(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
        }

        const res = makeRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(429);
        expect(next).not.toHaveBeenCalled();
    });

    test('tracks separate buckets per identifier — one client draining their bucket does not affect another', () => {
        const middleware = reqRateLimiter(5, 1, 2000, 'ip');
        const clientA = { ip: '1.1.1.1' };
        const clientB = { ip: '2.2.2.2' };

        // Fully drain client A.
        for (let i = 0; i < 5; i++) {
            middleware(clientA, makeRes(), jest.fn());
        }
        const aRes = makeRes();
        const aNext = jest.fn();
        middleware(clientA, aRes, aNext);
        expect(aRes.status).toHaveBeenCalledWith(429);
        expect(aNext).not.toHaveBeenCalled();

        // Client B should be completely unaffected — fresh, full bucket.
        const bRes = makeRes();
        const bNext = jest.fn();
        middleware(clientB, bRes, bNext);
        expect(bNext).toHaveBeenCalledTimes(1);
        expect(bRes.status).not.toHaveBeenCalled();
    });
});
