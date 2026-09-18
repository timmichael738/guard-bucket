const rbacConfig = require('../src/rbac');

const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

describe('rbacConfig factory validation', () => {
    test('throws if acceptableRoleList is missing', () => {
        expect(() => rbacConfig(undefined, () => 'admin')).toThrow('ACCEPTABLE_ROLE_LIST_MISSING');
    });

    test('throws if getRole is missing', () => {
        expect(() => rbacConfig(['admin'])).toThrow('GET_ROLE_FUNCTION_MISSING');
    });

    test('throws if acceptableRoleList is not an array', () => {
        expect(() => rbacConfig('admin', () => 'admin')).toThrow('MUST_BE_ARRAY');
    });

    test('throws if getRole is not a function', () => {
        expect(() => rbacConfig(['admin'], 'role')).toThrow('MUST_BE_FUNCTION');
    });

    test('does not throw with valid arguments', () => {
        expect(() => rbacConfig(['admin'], (req) => req.user.role)).not.toThrow();
    });
});

describe('rbacConfig middleware', () => {
    test('allows a request whose role is in the acceptable list', () => {
        const middleware = rbacConfig(['admin', 'editor'], (req) => req.user.role);
        const req = { user: { role: 'admin' } };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test('rejects a request whose role is not in the acceptable list, with 403', () => {
        const middleware = rbacConfig(['admin'], (req) => req.user.role);
        const req = { user: { role: 'user' } };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'REQUEST_VIA_INVALID_ROLE' });
        expect(next).not.toHaveBeenCalled();
    });

    test('calls the consumer-provided getRole function with req, instead of assuming a fixed shape', () => {
        const getRole = jest.fn((req) => req.customField.someRole);
        const middleware = rbacConfig(['admin'], getRole);
        const req = { customField: { someRole: 'admin' } };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(getRole).toHaveBeenCalledWith(req);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
