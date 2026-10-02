require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// อนุญาตให้ Frontend เรียกใช้ API ได้
app.use(cors());
app.use(express.json());

// ตั้งค่าเชื่อมต่อฐานข้อมูล TiDB
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

app.get('/', (req, res) => {
    res.send('FastNorder API is running perfectly!');
});

// ==========================================
// 1. ระบบจัดการลูกค้า (Customer APIs)
// ==========================================

// 1.1 ค้นหาลูกค้าในระยะที่กำหนด (ต้องอยู่ก่อน /:id)
app.get('/api/customers/nearby', async (req, res) => {
    const { lat, lng, distance } = req.query;
    try {
        // ใช้สูตร Haversine คำนวณระยะทางเป็นกิโลเมตร
        const query = `
            SELECT *, 
            ( 6371 * acos( cos( radians(?) ) * cos( radians( latitude ) ) 
            * cos( radians( longitude ) - radians(?) ) + sin( radians(?) ) 
            * sin( radians( latitude ) ) ) ) AS distance 
            FROM customers 
            HAVING distance <= ? 
            ORDER BY distance
        `;
        const [rows] = await pool.query(query, [lat, lng, lat, distance]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.2 ค้นหาลูกค้าจากส่วนหนึ่งของชื่อหรือนามสกุล
app.get('/api/customers/search', async (req, res) => {
    const { name } = req.query;
    try {
        const searchQuery = `%${name}%`;
        const [rows] = await pool.query(
            'SELECT * FROM customers WHERE first_name LIKE ? OR last_name LIKE ?',
            [searchQuery, searchQuery]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.3 แสดงข้อมูลลูกค้าทั้งหมด
app.get('/api/customers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.4 เพิ่มลูกค้าใหม่
app.post('/api/customers', async (req, res) => {
    const { first_name, last_name, phone, latitude, longitude } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO customers (first_name, last_name, phone, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
            [first_name, last_name, phone, latitude, longitude]
        );
        res.json({ customer_id: result.insertId, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.5 แก้ไขข้อมูลลูกค้า
app.put('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, phone, latitude, longitude } = req.body;
    try {
        await pool.query(
            'UPDATE customers SET first_name=?, last_name=?, phone=?, latitude=?, longitude=? WHERE customer_id=?',
            [first_name, last_name, phone, latitude, longitude, id]
        );
        res.json({ message: 'Updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1.6 ลบข้อมูลลูกค้า
app.delete('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    
    // 1. ดึง Connection เดียวมาใช้งานตลอดกระบวนการ
    const conn = await pool.getConnection();

    try {
        // 2. ลบลูกค้า
        await conn.query('DELETE FROM customers WHERE customer_id = ?', [id]);

        // 3. เช็กว่าเหลือลูกค้าอยู่กี่คน
        const [countResult] = await conn.query('SELECT COUNT(*) AS total FROM customers');
        const total = countResult[0].total;

        // 4. ถ้าลบจนตารางว่างเปล่า (total === 0) ให้สั่ง TRUNCATE ใน Connection เดียวกัน
        if (total === 0) {
            await conn.query('SET FOREIGN_KEY_CHECKS = 0');
            await conn.query('TRUNCATE TABLE orders');
            await conn.query('TRUNCATE TABLE customers');
            await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        }

        res.json({ message: 'Deleted successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        // 5. คืน Connection กลับเข้า Pool เสมอ
        conn.release();
    }
});

// ==========================================
// 2. ระบบจัดการรายการสั่งซื้อ (Order APIs)
// ==========================================

// 2.1 แสดงรายการสั่งซื้อทั้งหมด
app.get('/api/orders', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM orders ORDER BY order_id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2.2 เพิ่มรายการสั่งซื้อ
app.post('/api/orders', async (req, res) => {
    const { customer_id, order_date, box_count, delivery_lat, delivery_lng } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO orders (customer_id, order_date, box_count, delivery_lat, delivery_lng) VALUES (?, ?, ?, ?, ?)',
            [customer_id, order_date, box_count, delivery_lat, delivery_lng]
        );
        res.json({ order_id: result.insertId, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2.3 แก้ไขรายการสั่งซื้อ (เพิ่ม/ลด จำนวนกล่อง)
app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { customer_id, order_date, box_count, delivery_lat, delivery_lng } = req.body;
    try {
        await pool.query(
            'UPDATE orders SET customer_id=?, order_date=?, box_count=?, delivery_lat=?, delivery_lng=? WHERE order_id=?',
            [customer_id, order_date, box_count, delivery_lat, delivery_lng, id]
        );
        res.json({ message: 'Order updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2.4 ลบรายการสั่งซื้อ
// แก้ไข API ลบออร์เดอร์รายตัว
app.delete('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();

    try {
        // 1. ลบออร์เดอร์ตาม ID
        await conn.query('DELETE FROM orders WHERE order_id = ?', [id]);

        // 2. เช็กว่าเหลือ Order อยู่กี่รายการ
        const [countResult] = await conn.query('SELECT COUNT(*) AS total FROM orders');
        const total = countResult[0].total;

        // 3. ถ้าลบจนไม่เหลือออร์เดอร์เลย ให้สั่ง TRUNCATE เพื่อรีเซ็ต AUTO_INCREMENT กลับเป็น 1
        if (total === 0) {
            await conn.query('SET FOREIGN_KEY_CHECKS = 0');
            await conn.query('TRUNCATE TABLE orders');
            await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        }

        res.json({ message: 'Order deleted successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        conn.release();
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});