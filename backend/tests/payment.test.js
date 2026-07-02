const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/user.model');
const { connect, clearDatabase, closeDatabase } = require('./db');

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  jest.restoreAllMocks();
});
afterAll(async () => closeDatabase());

const managerToken = jwt.sign({ id: 'manager-1', role: 'manager' }, process.env.JWT_SECRET);

const createEmployeeWithBadge = async () => {
  const dateEarned = new Date('2024-03-15T00:00:00.000Z');
  const user = await User.create({
    name: 'Emily Johnson',
    email: 'emily@example.com',
    password: 'hashed',
    performanceMetrics: [{
      period: '2024-Q1',
      goals: [],
      badgesEarned: [{
        title: 'Blue',
        type: 'course',
        description: 'Completed React Advanced Course',
        dateEarned,
        approved: false
      }]
    }]
  });

  const badgeId = `2024-Q1-course-Blue-${dateEarned.toISOString()}`;
  return { user, badgeId };
};

describe('POST /api/payment/approve-badges', () => {
  it('marks the badge approved and notifies the n8n webhook with employee/badge details', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
    const { user, badgeId } = await createEmployeeWithBadge();

    const res = await request(app)
      .post('/api/payment/approve-badges')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerId: 'manager-1', employeeId: user._id.toString(), badgeIds: [badgeId] });

    expect(res.status).toBe(200);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.performanceMetrics[0].badgesEarned[0].approved).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(process.env.N8N_BADGE_APPROVED_WEBHOOK_URL);

    const payload = JSON.parse(options.body);
    expect(payload.employeeName).toBe('Emily Johnson');
    expect(payload.badgeName).toBe('Blue');
    expect(payload.message).toMatch(/1 badge approved/);
    expect(new Date(payload.approvedAt).toString()).not.toBe('Invalid Date');
  });

  it('does not notify or call the webhook when no badge ids match', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
    const { user } = await createEmployeeWithBadge();

    const res = await request(app)
      .post('/api/payment/approve-badges')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerId: 'manager-1', employeeId: user._id.toString(), badgeIds: ['non-matching-id'] });

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects the request with no auth token', async () => {
    const { user, badgeId } = await createEmployeeWithBadge();

    const res = await request(app)
      .post('/api/payment/approve-badges')
      .send({ managerId: 'manager-1', employeeId: user._id.toString(), badgeIds: [badgeId] });

    expect(res.status).toBe(401);
  });
});
