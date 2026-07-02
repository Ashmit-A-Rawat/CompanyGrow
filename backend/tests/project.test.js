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

const adminToken = jwt.sign({ id: 'admin-1', role: 'admin' }, process.env.JWT_SECRET);

describe('POST /api/project/addProject', () => {
  it('assigns the project and notifies the n8n webhook with employee/project/manager details', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true });

    const manager = await User.create({
      name: 'Michael Thompson',
      email: 'michael@example.com',
      password: 'hashed',
      role: 'manager'
    });
    const employee = await User.create({
      name: 'Emily Johnson',
      email: 'emily@example.com',
      password: 'hashed',
      role: 'employee'
    });

    const res = await request(app)
      .post('/api/project/addProject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'CompanyGrow Platform',
        description: 'Build the employee growth platform',
        assignedUsers: [employee._id.toString()],
        managerId: manager._id.toString()
      });

    expect(res.status).toBe(201);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(process.env.N8N_PROJECT_ASSIGNED_WEBHOOK_URL);

    const payload = JSON.parse(options.body);
    expect(payload.employeeName).toBe('Emily Johnson');
    expect(payload.employeeEmail).toBe('emily@example.com');
    expect(payload.projectName).toBe('CompanyGrow Platform');
    expect(payload.managerName).toBe('Michael Thompson');
    expect(new Date(payload.assignedAt).toString()).not.toBe('Invalid Date');
  });

  it('does not call the webhook when no users are assigned', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true });

    const manager = await User.create({
      name: 'Michael Thompson',
      email: 'michael@example.com',
      password: 'hashed',
      role: 'manager'
    });

    const res = await request(app)
      .post('/api/project/addProject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'CompanyGrow Platform',
        description: 'Build the employee growth platform',
        assignedUsers: [],
        managerId: manager._id.toString()
      });

    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
