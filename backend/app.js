const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const authRoute = require('./routes/auth.route');
app.use('/api/auth', authRoute);

const userRoute = require('./routes/user.route');
app.use('/api/user', userRoute);

const courseRoute = require('./routes/course.route');
app.use('/api/course', courseRoute);

const projectRoute = require('./routes/project.route');
app.use('/api/project', projectRoute);

const paymentRoute = require('./routes/payment.route');
app.use('/api/payment', paymentRoute);

app.get('/', (req, res) => {
  res.send('CompanyGrow API');
});

module.exports = app;
