const dotenv = require('dotenv');
dotenv.config();
const jwt = require('jsonwebtoken');
const express = require('express');
const { jwtHandler, reqRateLimiter, rbacConfig } = require('../index');

const app = express();

app.use(express.json());

const router = express.Router();

const SECRET = process.env.JWT_SECRET

router.post('/unprotected-router-call', (req, res) => {

    const userData = {
        id: '8hhf890wh89hhr-juf489',
        username: 'sampleTesting',
        role: req.body.role || 'user',
        email: 'sampletest@example.com',
    }

    const token = jwt.sign(userData, SECRET, { expiresIn: '1d' });

    return res.json({ message: "TOKEN ISSUED", token })
});

router.post('/protected-router-call', jwtHandler(SECRET), (req, res) => {

    const user = req.user;

    res.json({
        message: "User Data Successfully Logged!",
        data: user
    })

});

router.post('/rate-limited-call', reqRateLimiter(5, 1, 2000, 'ip'), (req, res) => {
    res.json({ message: 'Request allowed' });
});

router.post('/admin-only-call', jwtHandler(SECRET), rbacConfig(['admin'], (req) => req.user.role), (req, res) => {
    res.json({ message: 'Welcome, admin'});
})

app.use('/api/test', router);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(7000, () => {
    console.log('Server is running on port 7000');
});