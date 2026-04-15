use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Context;
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Text};
use diesel::{QueryableByName, RunQueryDsl, SqliteConnection, sql_query};

#[derive(Debug)]
pub struct ProjectRegistry {
    db_path: PathBuf,
}

impl ProjectRegistry {
    pub fn new(db_path: PathBuf) -> anyhow::Result<Self> {
        let registry = Self { db_path };
        registry.init()?;
        Ok(registry)
    }

    pub fn add_project(&self, path: &Path) -> anyhow::Result<()> {
        let canonical = canonicalize_project_path(path)?;
        let mut connection = self.open()?;
        sql_query(
            "
            INSERT INTO opened_projects (path, last_opened_at)
            VALUES (?1, unixepoch())
            ON CONFLICT(path) DO NOTHING
            ",
        )
        .bind::<Text, _>(canonical)
        .execute(&mut connection)?;
        Ok(())
    }

    pub fn list_projects(&self) -> anyhow::Result<Vec<PathBuf>> {
        let mut connection = self.open()?;
        let rows: Vec<ProjectRow> = sql_query(
            "
            SELECT path, last_opened_at
            FROM opened_projects
            ORDER BY last_opened_at DESC, path ASC
            ",
        )
        .load(&mut connection)?;

        Ok(rows
            .into_iter()
            .map(|row| PathBuf::from(row.path))
            .filter(|path| path.exists())
            .collect())
    }

    fn init(&self) -> anyhow::Result<()> {
        if let Some(parent) = self.db_path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!(
                    "Failed to create project registry directory at {}",
                    parent.display()
                )
            })?;
        }

        let mut connection = self.open()?;
        connection.batch_execute(
            "
            CREATE TABLE IF NOT EXISTS opened_projects (
              path TEXT PRIMARY KEY,
              last_opened_at INTEGER NOT NULL
            );
            ",
        )?;
        Ok(())
    }

    fn open(&self) -> anyhow::Result<SqliteConnection> {
        SqliteConnection::establish(self.db_path.to_string_lossy().as_ref()).with_context(|| {
            format!(
                "Failed to open project registry database at {}",
                self.db_path.display()
            )
        })
    }
}

#[derive(QueryableByName)]
struct ProjectRow {
    #[diesel(sql_type = Text)]
    path: String,
    #[diesel(sql_type = BigInt)]
    #[allow(dead_code)]
    last_opened_at: i64,
}

fn canonicalize_project_path(path: &Path) -> anyhow::Result<String> {
    Ok(path
        .canonicalize()
        .with_context(|| format!("Failed to canonicalize project path {}", path.display()))?
        .to_string_lossy()
        .into_owned())
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::*;

    #[test]
    fn stores_projects_in_recent_order() {
        let root = TempDir::new().expect("root");
        let a = root.path().join("a");
        let b = root.path().join("b");
        fs::create_dir_all(&a).expect("a");
        fs::create_dir_all(&b).expect("b");
        let registry = ProjectRegistry::new(root.path().join("registry.db")).expect("registry");

        registry.add_project(&a).expect("add a");
        std::thread::sleep(std::time::Duration::from_secs(1));
        registry.add_project(&b).expect("add b");

        let projects = registry.list_projects().expect("list");
        assert_eq!(
            projects,
            vec![b.canonicalize().unwrap(), a.canonicalize().unwrap()]
        );
    }

    #[test]
    fn reopening_a_project_does_not_change_its_order() {
        let root = TempDir::new().expect("root");
        let a = root.path().join("a");
        let b = root.path().join("b");
        fs::create_dir_all(&a).expect("a");
        fs::create_dir_all(&b).expect("b");
        let registry = ProjectRegistry::new(root.path().join("registry.db")).expect("registry");

        registry.add_project(&a).expect("add a");
        std::thread::sleep(std::time::Duration::from_secs(1));
        registry.add_project(&b).expect("add b");
        std::thread::sleep(std::time::Duration::from_secs(1));
        registry.add_project(&a).expect("reopen a");

        let projects = registry.list_projects().expect("list");
        assert_eq!(
            projects,
            vec![b.canonicalize().unwrap(), a.canonicalize().unwrap()]
        );
    }
}
