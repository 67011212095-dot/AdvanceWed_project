require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const createAuthRouter = require('./auth'); 

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.use(express.json());

const cors = require('cors');
app.use(cors()); 

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

app.use('/api', createAuthRouter(pool)); // ← เพิ่ม (login / register)

app.get('/', (req, res) => {
    res.send('FastNorder API is running perfectly!');
});


app.get('/api/customers/nearby', async (req, res) => {
    const { lat, lng, distance } = req.query;
    try {
        
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


app.get('/api/customers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


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

app.delete('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    

    const conn = await pool.getConnection();

    try {
       
        await conn.query('DELETE FROM customers WHERE customer_id = ?', [id]);

       
        const [countResult] = await conn.query('SELECT COUNT(*) AS total FROM customers');
        const total = countResult[0].total;

        
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
        
        conn.release();
    }
});


app.get('/api/orders', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM orders ORDER BY order_id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


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


app.delete('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();

    try {
        
        await conn.query('DELETE FROM orders WHERE order_id = ?', [id]);

        
        const [countResult] = await conn.query('SELECT COUNT(*) AS total FROM orders');
        const total = countResult[0].total;

        
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
