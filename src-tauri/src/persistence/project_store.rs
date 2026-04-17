use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Context;
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_types::Text;
use diesel::{QueryableByName, RunQueryDsl, SqliteConnection, sql_query};

#[derive(Debug)]
pub struct ProjectStore {
    db_path: PathBuf,
}

impl ProjectStore {
    pub fn new(db_path: PathBuf) -> anyhow::Result<Self> {
        let store = Self { db_path };
        store.init()?;
        Ok(store)
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
        let rows: Vec<ProjectPathRow> = sql_query(
            "
            SELECT path
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
struct ProjectPathRow {
    #[diesel(sql_type = Text)]
    path: String,
}

fn canonicalize_project_path(path: &Path) -> anyhow::Result<String> {
    Ok(path
        .canonicalize()
        .with_context(|| format!("Failed to canonicalize project path {}", path.display()))?
        .to_string_lossy()
        .into_owned())
}
