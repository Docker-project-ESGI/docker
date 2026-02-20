import { useState, useEffect } from 'react'
import './App.css'

// Configuration API - Utilise variable d'environnement ou valeur par défaut
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', description: '' });
  const [editingTask, setEditingTask] = useState(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });

  // Charger les tâches au démarrage
  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

  // Récupérer toutes les tâches
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/tasks`);
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Cannot connect to API: ' + err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les statistiques
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  };

  // Créer une nouvelle tâche
  const createTask = async (e) => {
    e.preventDefault();
    
    if (!newTask.title.trim()) {
      alert('Le titre est requis');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTask),
      });

      const data = await response.json();

      if (data.success) {
        setTasks([data.data, ...tasks]);
        setNewTask({ title: '', description: '' });
        fetchStats();
      } else {
        alert('Erreur: ' + data.error);
      }
    } catch (err) {
      alert('Erreur de connexion: ' + err.message);
    }
  };

  // Modifier une tâche
  const updateTask = async (id, updates) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success) {
        setTasks(tasks.map(task => task.id === id ? data.data : task));
        setEditingTask(null);
        fetchStats();
      } else {
        alert('Erreur: ' + data.error);
      }
    } catch (err) {
      alert('Erreur de connexion: ' + err.message);
    }
  };

  // Supprimer une tâche
  const deleteTask = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setTasks(tasks.filter(task => task.id !== id));
        fetchStats();
      } else {
        alert('Erreur: ' + data.error);
      }
    } catch (err) {
      alert('Erreur de connexion: ' + err.message);
    }
  };

  // Toggle completed status
  const toggleComplete = (task) => {
    updateTask(task.id, { completed: !task.completed });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Task Manager</h1>
        <p>ESGI - Projet Final Docker</p>
      </header>

      {/* Statistiques */}
      <div className="stats">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">Complétées</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">En cours</div>
        </div>
      </div>

      {/* Formulaire de création */}
      <div className="create-form">
        <h2>Nouvelle tâche</h2>
        <form onSubmit={createTask}>
          <input
            type="text"
            placeholder="Titre de la tâche"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="input-field"
          />
          <textarea
            placeholder="Description (optionnelle)"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            className="input-field"
            rows="3"
          />
          <button type="submit" className="btn btn-primary">
            Créer la tâche
          </button>
        </form>
      </div>

      {/* Liste des tâches */}
      <div className="tasks-container">
        <h2>Mes tâches</h2>

        {loading && <p className="loading">Chargement...</p>}
        
        {error && <p className="error"> {error}</p>}

        {!loading && !error && tasks.length === 0 && (
          <p className="empty-state">Aucune tâche. Créez-en une ci-dessus !</p>
        )}

        <div className="tasks-list">
          {tasks.map((task) => (
            <div key={task.id} className={`task-card ${task.completed ? 'completed' : ''}`}>
              {editingTask?.id === task.id ? (
                // Mode édition
                <div className="task-edit">
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="input-field"
                  />
                  <textarea
                    value={editingTask.description}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    className="input-field"
                    rows="2"
                  />
                  <div className="task-actions">
                    <button
                      onClick={() => updateTask(task.id, editingTask)}
                      className="btn btn-success"
                    >
                      ✅ Sauvegarder
                    </button>
                    <button
                      onClick={() => setEditingTask(null)}
                      className="btn btn-secondary"
                    >
                      ❌ Annuler
                    </button>
                  </div>
                </div>
              ) : (
                // Mode affichage
                <>
                  <div className="task-header">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleComplete(task)}
                      className="task-checkbox"
                    />
                    <h3 className="task-title">{task.title}</h3>
                  </div>
                  
                  {task.description && (
                    <p className="task-description">{task.description}</p>
                  )}
                  
                  <div className="task-meta">
                    <span className="task-date">
                      Créée le {new Date(task.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    {task.completed && (
                      <span className="task-badge">✅ Complétée</span>
                    )}
                  </div>

                  <div className="task-actions">
                    <button
                      onClick={() => setEditingTask(task)}
                      className="btn btn-secondary"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="btn btn-danger"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <footer className="App-footer">
        <p>Dockerisé avec ❤️ - ESGI 2026</p>
      </footer>
    </div>
  )
}

export default App
