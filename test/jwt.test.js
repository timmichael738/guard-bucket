const jwt = require('jsonwebtoken');
const jwtHandler = require('../src/jwt');

const SECRET = 'test-secret';

const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

describe('jwtHandler factory validation', () => {
    test('throws if secret is missing', () => {
        expect(() => jwtHandler()).toThrow('SECRET_ARGUEMENT_IS_MISSING');
    });

    test('throws if secret is not a string', () => {
        expect(() => jwtHandler(12345)).toThrow('INVALID_SECRET_TYPE');
    });

    test('does not throw when given a valid string secret', () => {
        expect(() => jwtHandler(SECRET)).not.toThrow();
    });
});

describe('jwtHandler middleware', () => {
    test('rejects a request with no token (no header, no cookie)', () => {
        const middleware = jwtHandler(SECRET);
        const req = { headers: {} };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'MISSING_TOKEN' });
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects a tampered/invalid token', () => {
        const middleware = jwtHandler(SECRET);
        const validToken = jwt.sign({ id: 1 }, SECRET);
        const tamperedToken = validToken.slice(0, -3) + 'xxx';
        const req = { headers: { authorization: `Bearer ${tamperedToken}` } };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'INVALID_TOKEN' });
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects a token signed with a different secret', () => {
        const middleware = jwtHandler(SECRET);
        const wrongSecretToken = jwt.sign({ id: 1 }, 'a-completely-different-secret');
        const req = { headers: { authorization: `Bearer ${wrongSecretToken}` } };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'INVALID_TOKEN' });
        expect(next).not.toHaveBeenCalled();
    });

    test('accepts a valid token via the Authorization header and attaches decoded payload to req.user', () => {
        const middleware = jwtHandler(SECRET);
        const payload = { id: 'abc123', role: 'admin' };
        const token = jwt.sign(payload, SECRET);
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(req.user).toMatchObject(payload);
    });

    test('accepts a valid token via a cookie when no Authorization header is present', () => {
        const middleware = jwtHandler(SECRET);
        const payload = { id: 'abc123', role: 'user' };
        const token = jwt.sign(payload, SECRET);
        const req = { headers: { cookie: `token=${token}` } };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user).toMatchObject(payload);
    });
});
