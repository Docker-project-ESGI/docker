-- ==========================================
-- TASK MANAGER - PostgreSQL Initialization
-- ==========================================
-- Ce script sera exécuté automatiquement au démarrage de Postgres

-- Créer la table tasks si elle n'existe pas
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insérer des données de test (optionnel - commentez si non désiré)
INSERT INTO tasks (title, description, completed) VALUES
    ('Dockeriser le frontend', 'Créer un Dockerfile multi-stage pour React/Vite', false),
    ('Dockeriser le backend', 'Créer un Dockerfile multi-stage pour Node.js/Express', false),
    ('Créer les scripts bash', 'build.sh, start.sh, stop.sh, backup-db.sh, restore-db.sh', false),
    ('Configurer les réseaux', 'Créer frontend et backend (isolé)', false),
    ('Configurer les volumes', 'postgres-data et redis-data', false),
    ('Scanner avec Trivy', 'Vérifier les vulnérabilités des images', false),
    ('Documenter le projet', 'README.md, ARCHITECTURE.md, SECURITY.md, etc.', false),
    ('Préparer la soutenance', 'Démo live et présentation de 15 minutes', false)
ON CONFLICT DO NOTHING;

-- Afficher un message de confirmation
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully!';
    RAISE NOTICE 'Table "tasks" created with triggers';
    RAISE NOTICE 'Sample tasks inserted';
END $$;
