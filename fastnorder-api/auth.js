const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = function createAuthRouter(pool) {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

  // สร้างบัญชีเริ่มต้นถ้าตาราง users ยังว่าง
  (async () => {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users');
      if (rows[0].total === 0) {
        await pool.query(
          'INSERT INTO users (username, full_name, role, password_hash) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
          [
            'admin', 'เจ้าของร้าน', 'dispatch', bcrypt.hashSync('1234', 10),
            'rider', 'ไรเดอร์ทดลอง', 'rider', bcrypt.hashSync('1234', 10),
          ]
        );
        console.log('Seeded default users: admin / rider (password 1234)');
      }
    } catch (err) {
      console.error('Seed users failed (สร้างตาราง users แล้วหรือยัง?):', err.message);
    }
  })();

  // POST /api/register
  router.post('/register', async (req, res) => {
    const { username, password, fullName, role } = req.body || {};

    if (!username || !password || !['dispatch', 'rider'].includes(role)) {
      return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง' });
    }

    try {
      const [exists] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
      if (exists.length > 0) {
        return res.status(409).json({ message: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO users (username, full_name, role, password_hash) VALUES (?, ?, ?, ?)',
        [username, fullName || username, role, passwordHash]
      );
      res.status(201).json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/login
  router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};

    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
      const user = rows[0];

      if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
        return res.status(401).json({ message: 'invalid credentials' });
      }

      const token = jwt.sign({ id: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token, role: user.role });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
};