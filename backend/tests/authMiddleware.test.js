const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('auth middleware', () => {
  it('calls next() and attaches decoded user for a valid token', () => {
    const token = jwt.sign({ id: '123', role: 'employee' }, process.env.JWT_SECRET);
    const req = { header: () => `Bearer ${token}` };
    const res = mockRes();
    const next = jest.fn();

    auth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: '123', role: 'employee' });
  });

  it('rejects a request with no Authorization header', () => {
    const req = { header: () => undefined };
    const res = mockRes();
    const next = jest.fn();

    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request with an invalid token', () => {
    const req = { header: () => 'Bearer not-a-real-token' };
    const res = mockRes();
    const next = jest.fn();

    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
