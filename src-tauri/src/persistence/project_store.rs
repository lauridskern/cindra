use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use anyhow::Context;
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Text};
use diesel::{QueryableByName, RunQueryDsl, SqliteConnection, sql_query};

#[derive(Debug)]
pub struct ProjectStore {
    db_path: PathBuf,
    connection_lock: Mutex<()>,
}

#[derive(Debug, Clone, QueryableByName)]
pub struct SavedWorkspaceSummaryRecord {
    #[diesel(sql_type = Text)]
    pub id: String,
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = BigInt)]
    pub updated_at: i64,
}

#[derive(Debug, Clone, QueryableByName)]
pub struct SavedWorkspaceRecord {
    #[diesel(sql_type = Text)]
    pub id: String,
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = Text)]
    pub layout_json: String,
    #[diesel(sql_type = BigInt)]
    pub updated_at: i64,
}

impl ProjectStore {
    pub fn new(db_path: PathBuf) -> anyhow::Result<Self> {
        let store = Self {
            db_path,
            connection_lock: Mutex::new(()),
        };
        store.init()?;
        Ok(store)
    }

    pub fn add_project(&self, path: &Path) -> anyhow::Result<()> {
        let canonical = canonicalize_project_path(path)?;
        self.with_connection(|connection| {
            sql_query(
                "
                INSERT INTO opened_projects (path, last_opened_at)
                VALUES (?1, unixepoch())
                ON CONFLICT(path) DO NOTHING
                ",
            )
            .bind::<Text, _>(canonical)
            .execute(connection)?;
            Ok(())
        })
    }

    pub fn list_projects(&self) -> anyhow::Result<Vec<PathBuf>> {
        self.with_connection(|connection| {
            let rows: Vec<ProjectPathRow> = sql_query(
                "
                SELECT path
                FROM opened_projects
                ORDER BY last_opened_at DESC, path ASC
                ",
            )
            .load(connection)?;

            Ok(rows
                .into_iter()
                .map(|row| PathBuf::from(row.path))
                .filter(|path| path.exists())
                .collect())
        })
    }

    pub fn save_conversation_layout(
        &self,
        conversation_id: &str,
        layout_json: &str,
    ) -> anyhow::Result<()> {
        self.with_connection(|connection| {
            sql_query(
                "
                INSERT INTO conversation_layouts (conversation_id, layout_json, updated_at)
                VALUES (?1, ?2, unixepoch())
                ON CONFLICT(conversation_id) DO UPDATE SET
                  layout_json = excluded.layout_json,
                  updated_at = excluded.updated_at
                ",
            )
            .bind::<Text, _>(conversation_id)
            .bind::<Text, _>(layout_json)
            .execute(connection)?;
            Ok(())
        })
    }

    pub fn get_conversation_layout(&self, conversation_id: &str) -> anyhow::Result<Option<String>> {
        self.with_connection(|connection| {
            let rows: Vec<ConversationLayoutRow> = sql_query(
                "
                SELECT layout_json
                FROM conversation_layouts
                WHERE conversation_id = ?1
                LIMIT 1
                ",
            )
            .bind::<Text, _>(conversation_id)
            .load(connection)?;

            Ok(rows.into_iter().next().map(|row| row.layout_json))
        })
    }

    pub fn create_saved_workspace(
        &self,
        workspace_id: &str,
        name: &str,
        layout_json: &str,
    ) -> anyhow::Result<SavedWorkspaceRecord> {
        self.with_connection(|connection| {
            connection.transaction(|connection| {
                sql_query(
                    "
                    INSERT INTO saved_workspaces (id, name, created_at, updated_at)
                    VALUES (?1, ?2, unixepoch(), unixepoch())
                    ",
                )
                .bind::<Text, _>(workspace_id)
                .bind::<Text, _>(name)
                .execute(connection)?;

                sql_query(
                    "
                    INSERT INTO saved_workspace_layouts (workspace_id, layout_json, updated_at)
                    VALUES (?1, ?2, unixepoch())
                    ",
                )
                .bind::<Text, _>(workspace_id)
                .bind::<Text, _>(layout_json)
                .execute(connection)?;

                load_saved_workspace_record(connection, workspace_id)
            })
        })
    }

    pub fn update_saved_workspace_layout(
        &self,
        workspace_id: &str,
        layout_json: &str,
    ) -> anyhow::Result<SavedWorkspaceRecord> {
        self.with_connection(|connection| {
            connection.transaction(|connection| {
                sql_query(
                    "
                    UPDATE saved_workspaces
                    SET updated_at = unixepoch()
                    WHERE id = ?1
                    ",
                )
                .bind::<Text, _>(workspace_id)
                .execute(connection)?;

                sql_query(
                    "
                    INSERT INTO saved_workspace_layouts (workspace_id, layout_json, updated_at)
                    VALUES (?1, ?2, unixepoch())
                    ON CONFLICT(workspace_id) DO UPDATE SET
                      layout_json = excluded.layout_json,
                      updated_at = excluded.updated_at
                    ",
                )
                .bind::<Text, _>(workspace_id)
                .bind::<Text, _>(layout_json)
                .execute(connection)?;

                load_saved_workspace_record(connection, workspace_id)
            })
        })
    }

    pub fn list_saved_workspaces(&self) -> anyhow::Result<Vec<SavedWorkspaceSummaryRecord>> {
        self.with_connection(|connection| {
            let rows = sql_query(
                "
                SELECT id, name, updated_at
                FROM saved_workspaces
                ORDER BY created_at DESC, id ASC
                ",
            )
            .load(connection)?;

            Ok(rows)
        })
    }

    pub fn get_saved_workspace(
        &self,
        workspace_id: &str,
    ) -> anyhow::Result<Option<SavedWorkspaceRecord>> {
        self.with_connection(|connection| {
            load_optional_saved_workspace_record(connection, workspace_id)
        })
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

        self.with_connection(|connection| {
            connection.batch_execute(
                "
                CREATE TABLE IF NOT EXISTS opened_projects (
                  path TEXT PRIMARY KEY,
                  last_opened_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS conversation_layouts (
                  conversation_id TEXT PRIMARY KEY,
                  layout_json TEXT NOT NULL,
                  updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS saved_workspaces (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  created_at INTEGER NOT NULL,
                  updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS saved_workspace_layouts (
                  workspace_id TEXT PRIMARY KEY,
                  layout_json TEXT NOT NULL,
                  updated_at INTEGER NOT NULL,
                  FOREIGN KEY(workspace_id) REFERENCES saved_workspaces(id) ON DELETE CASCADE
                );
                ",
            )?;
            Ok(())
        })
    }

    fn open(&self) -> anyhow::Result<SqliteConnection> {
        let mut connection = SqliteConnection::establish(self.db_path.to_string_lossy().as_ref())
            .with_context(|| {
            format!(
                "Failed to open project registry database at {}",
                self.db_path.display()
            )
        })?;
        connection.batch_execute(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA busy_timeout = 5000;
            PRAGMA foreign_keys = ON;
            ",
        )?;
        Ok(connection)
    }

    fn with_connection<T>(
        &self,
        operation: impl FnOnce(&mut SqliteConnection) -> anyhow::Result<T>,
    ) -> anyhow::Result<T> {
        let _connection_lock = self
            .connection_lock
            .lock()
            .expect("project store mutex poisoned");
        let mut connection = self.open()?;
        operation(&mut connection)
    }
}

#[derive(QueryableByName)]
struct ProjectPathRow {
    #[diesel(sql_type = Text)]
    path: String,
}

#[derive(QueryableByName)]
struct ConversationLayoutRow {
    #[diesel(sql_type = Text)]
    layout_json: String,
}

fn canonicalize_project_path(path: &Path) -> anyhow::Result<String> {
    Ok(path
        .canonicalize()
        .with_context(|| format!("Failed to canonicalize project path {}", path.display()))?
        .to_string_lossy()
        .into_owned())
}

fn load_saved_workspace_record(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> anyhow::Result<SavedWorkspaceRecord> {
    load_optional_saved_workspace_record(connection, workspace_id)?
        .with_context(|| format!("Saved workspace not found: {workspace_id}"))
}

fn load_optional_saved_workspace_record(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> anyhow::Result<Option<SavedWorkspaceRecord>> {
    let rows: Vec<SavedWorkspaceRecord> = sql_query(
        "
        SELECT sw.id, sw.name, swl.layout_json, sw.updated_at
        FROM saved_workspaces sw
        INNER JOIN saved_workspace_layouts swl
          ON swl.workspace_id = sw.id
        WHERE sw.id = ?1
        LIMIT 1
        ",
    )
    .bind::<Text, _>(workspace_id)
    .load(connection)?;

    Ok(rows.into_iter().next())
}
