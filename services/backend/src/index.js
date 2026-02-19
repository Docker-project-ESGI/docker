// ==========================================
// TASK MANAGER - Backend API Node.js/Express
// ==========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const redis = require('redis');

// ==========================================
// Configuration
// ==========================================

const app = express();
const PORT = process.env.API_PORT || 3000;
const HOST = process.env.API_HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ==========================================
// PostgreSQL Connection Pool
// ==========================================

const pgPool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'taskuser',
  password: process.env.DB_PASS || 'secure_password_change_me',
  database: process.env.DB_NAME || 'tasks_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connexion PostgreSQL
pgPool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pgPool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

// ==========================================
// Redis Connection
// ==========================================

let redisClient;
let redisConnected = false;

(async () => {
  try {
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379
      },
      password: process.env.REDIS_PASS || undefined
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
      redisConnected = true;
    });

    await redisClient.connect();
  } catch (error) {
    console.error('Redis not available, continuing without cache:', error.message);
    redisConnected = false;
  }
})();

// ==========================================
// Helper Functions
// ==========================================

// Cache helper
async function getFromCache(key) {
  if (!redisConnected) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

async function setInCache(key, value, expirationSeconds = 300) {
  if (!redisConnected) return;
  try {
    await redisClient.setEx(key, expirationSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

async function invalidateCache(pattern = 'tasks:*') {
  if (!redisConnected) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

// ==========================================
// Routes - Health Check
// ==========================================

app.get('/health', async (req, res) => {
  try {
    // Test PostgreSQL
    const pgResult = await pgPool.query('SELECT NOW()');
    const pgStatus = pgResult.rows ? 'ok' : 'error';

    // Test Redis
    let redisStatus = 'unavailable';
    if (redisConnected) {
      try {
        await redisClient.ping();
        redisStatus = 'ok';
      } catch (error) {
        redisStatus = 'error';
      }
    }

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        database: pgStatus,
        cache: redisStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==========================================
// Routes - Tasks CRUD
// ==========================================

// GET /api/tasks - Liste toutes les tâches
app.get('/api/tasks', async (req, res) => {
  try {
    // Essayer le cache d'abord
    const cacheKey = 'tasks:all';
    const cachedData = await getFromCache(cacheKey);
    
    if (cachedData) {
      console.log('Cache hit: tasks:all');
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // Si pas en cache, requête DB
    const result = await pgPool.query(
      'SELECT id, title, description, completed, created_at, updated_at FROM tasks ORDER BY created_at DESC'
    );

    const tasks = result.rows;

    // Mettre en cache
    await setInCache(cacheKey, tasks, 60);

    res.status(200).json({
      success: true,
      data: tasks,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/tasks/:id - Récupérer une tâche par ID
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Essayer le cache
    const cacheKey = `tasks:${id}`;
    const cachedData = await getFromCache(cacheKey);

    if (cachedData) {
      console.log(`Cache hit: tasks:${id}`);
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // Requête DB
    const result = await pgPool.query(
      'SELECT id, title, description, completed, created_at, updated_at FROM tasks WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const task = result.rows[0];

    // Mettre en cache
    await setInCache(cacheKey, task, 300);

    res.status(200).json({
      success: true,
      data: task,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/tasks - Créer une nouvelle tâche
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    const result = await pgPool.query(
      'INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING id, title, description, completed, created_at, updated_at',
      [title, description || '']
    );

    const newTask = result.rows[0];

    // Invalider le cache
    await invalidateCache('tasks:*');

    res.status(201).json({
      success: true,
      data: newTask
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/tasks/:id - Modifier une tâche
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed } = req.body;

    // Vérifier que la tâche existe
    const checkResult = await pgPool.query(
      'SELECT id FROM tasks WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // Construire la requête de mise à jour
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (completed !== undefined) {
      updates.push(`completed = $${paramCount}`);
      values.push(completed);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE tasks 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, title, description, completed, created_at, updated_at
    `;

    const result = await pgPool.query(query, values);
    const updatedTask = result.rows[0];

    // Invalider le cache
    await invalidateCache('tasks:*');

    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/tasks/:id - Supprimer une tâche
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pgPool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // Invalider le cache
    await invalidateCache('tasks:*');

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// Routes - Statistics (bonus)
// ==========================================

app.get('/api/stats', async (req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN completed = true THEN 1 END) as completed,
        COUNT(CASE WHEN completed = false THEN 1 END) as pending
      FROM tasks
    `);

    const stats = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        total: parseInt(stats.total),
        completed: parseInt(stats.completed),
        pending: parseInt(stats.pending)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// Route par défaut
// ==========================================

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Task Manager API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      tasks: {
        list: 'GET /api/tasks',
        get: 'GET /api/tasks/:id',
        create: 'POST /api/tasks',
        update: 'PUT /api/tasks/:id',
        delete: 'DELETE /api/tasks/:id'
      },
      stats: 'GET /api/stats'
    }
  });
});

// ==========================================
// Démarrage du serveur
// ==========================================

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('=====================================');
  console.log(' Task Manager API - Backend Server');
  console.log('=====================================');
  console.log(` Server running on http://${HOST}:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log(` Cache: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
  console.log('=====================================');
  console.log('');
});

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing gracefully...');
  if (redisClient) await redisClient.quit();
  await pgPool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing gracefully...');
  if (redisClient) await redisClient.quit();
  await pgPool.end();
  process.exit(0);
});
