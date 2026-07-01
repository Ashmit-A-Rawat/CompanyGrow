const request = require('supertest');
const app = require('../app');
const { connect, clearDatabase, closeDatabase } = require('./db');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const validSignup = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '1234567890',
  password: 'password123',
  experience: 2,
  skills: 'JavaScript, Node.js'
};

describe('POST /api/auth/signup', () => {
  it('creates a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/signup').send(validSignup);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.email).toBe(validSignup.email);
    expect(res.body.role).toBe('employee');
  });

  it('rejects signup with missing required fields', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'incomplete@example.com' });

    expect(res.status).toBe(400);
  });

  it('rejects signup with a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send(validSignup);
    const res = await request(app).post('/api/auth/signup').send(validSignup);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/signup').send(validSignup);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: validSignup.email,
      password: validSignup.password
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe('employee');
  });

  it('rejects login with an incorrect password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: validSignup.email,
      password: 'wrongpassword'
    });

    expect(res.status).toBe(400);
  });

  it('rejects login with an unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: validSignup.password
    });

    expect(res.status).toBe(400);
  });
});
