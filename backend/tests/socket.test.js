const http = require('http');
const jwt = require('jsonwebtoken');
const { io: Client } = require('socket.io-client');
const app = require('../app');
const { initSocket, notifyUser } = require('../socket');

let httpServer;
let port;

beforeAll((done) => {
  httpServer = http.createServer(app);
  initSocket(httpServer);
  httpServer.listen(() => {
    port = httpServer.address().port;
    done();
  });
});

afterAll((done) => {
  httpServer.close(done);
});

const makeToken = (id) => jwt.sign({ id, role: 'employee' }, process.env.JWT_SECRET);

describe('socket.io notifications', () => {
  it('delivers an event only to the authenticated user\'s own room', (done) => {
    const userId = 'user-123';
    const otherUserId = 'user-456';

    const client = Client(`http://localhost:${port}`, { auth: { token: makeToken(userId) } });
    const otherClient = Client(`http://localhost:${port}`, { auth: { token: makeToken(otherUserId) } });

    otherClient.on('badge:approved', () => {
      done(new Error('a different user should never receive this notification'));
    });

    client.on('badge:approved', (payload) => {
      expect(payload.message).toBe('hello');
      client.close();
      otherClient.close();
      done();
    });

    Promise.all([
      new Promise((resolve) => client.on('connect', resolve)),
      new Promise((resolve) => otherClient.on('connect', resolve))
    ]).then(() => {
      notifyUser(userId, 'badge:approved', { message: 'hello' });
    });
  });

  it('rejects a connection with no token', (done) => {
    const client = Client(`http://localhost:${port}`, { auth: {} });

    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/Authentication required/);
      client.close();
      done();
    });
  });

  it('rejects a connection with an invalid token', (done) => {
    const client = Client(`http://localhost:${port}`, { auth: { token: 'not-a-real-token' } });

    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/Invalid token/);
      client.close();
      done();
    });
  });
});
