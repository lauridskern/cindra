use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::ExitStatus;
use std::sync::Arc;

use bytes::Bytes;
use forge_app::{
    CommandInfra, DirectoryReaderInfra, EnvironmentInfra, FileDirectoryInfra, FileInfoInfra,
    FileReaderInfra, FileRemoverInfra, FileWriterInfra, GrpcInfra, HttpInfra, McpServerInfra,
    StrategyFactory, UserInfra, WalkedFile, Walker, WalkerInfra,
};
use forge_domain::{
    AuthMethod, CommandOutput, FileInfo, McpServerConfig, ProviderId, URLParamSpec,
};
use forge_infra::ForgeInfra;
use reqwest::header::HeaderMap;
use reqwest::{Response, Url};
use reqwest_eventsource::EventSource;

use crate::followup::FollowupBridge;

#[derive(Clone)]
pub struct DesktopInfra {
    inner: ForgeInfra,
    followups: Arc<FollowupBridge>,
}

impl DesktopInfra {
    pub fn new(inner: ForgeInfra, followups: Arc<FollowupBridge>) -> Self {
        Self { inner, followups }
    }
}

impl EnvironmentInfra for DesktopInfra {
    type Config = forge_config::ForgeConfig;

    fn get_env_var(&self, key: &str) -> Option<String> {
        self.inner.get_env_var(key)
    }

    fn get_env_vars(&self) -> BTreeMap<String, String> {
        self.inner.get_env_vars()
    }

    fn get_environment(&self) -> forge_domain::Environment {
        self.inner.get_environment()
    }

    fn get_config(&self) -> anyhow::Result<Self::Config> {
        self.inner.get_config()
    }

    async fn update_environment(
        &self,
        ops: Vec<forge_domain::ConfigOperation>,
    ) -> anyhow::Result<()> {
        self.inner.update_environment(ops).await
    }
}

#[async_trait::async_trait]
impl FileReaderInfra for DesktopInfra {
    async fn read_utf8(&self, path: &Path) -> anyhow::Result<String> {
        self.inner.read_utf8(path).await
    }

    fn read_batch_utf8(
        &self,
        batch_size: usize,
        paths: Vec<PathBuf>,
    ) -> impl futures::Stream<Item = (PathBuf, anyhow::Result<String>)> + Send {
        self.inner.read_batch_utf8(batch_size, paths)
    }

    async fn read(&self, path: &Path) -> anyhow::Result<Vec<u8>> {
        self.inner.read(path).await
    }

    async fn range_read_utf8(
        &self,
        path: &Path,
        start_line: u64,
        end_line: u64,
    ) -> anyhow::Result<(String, FileInfo)> {
        self.inner.range_read_utf8(path, start_line, end_line).await
    }
}

#[async_trait::async_trait]
impl FileWriterInfra for DesktopInfra {
    async fn write(&self, path: &Path, contents: Bytes) -> anyhow::Result<()> {
        self.inner.write(path, contents).await
    }

    async fn append(&self, path: &Path, contents: Bytes) -> anyhow::Result<()> {
        self.inner.append(path, contents).await
    }

    async fn write_temp(&self, prefix: &str, ext: &str, content: &str) -> anyhow::Result<PathBuf> {
        self.inner.write_temp(prefix, ext, content).await
    }
}

#[async_trait::async_trait]
impl FileRemoverInfra for DesktopInfra {
    async fn remove(&self, path: &Path) -> anyhow::Result<()> {
        self.inner.remove(path).await
    }
}

#[async_trait::async_trait]
impl FileInfoInfra for DesktopInfra {
    async fn is_binary(&self, path: &Path) -> anyhow::Result<bool> {
        self.inner.is_binary(path).await
    }

    async fn is_file(&self, path: &Path) -> anyhow::Result<bool> {
        self.inner.is_file(path).await
    }

    async fn exists(&self, path: &Path) -> anyhow::Result<bool> {
        self.inner.exists(path).await
    }

    async fn file_size(&self, path: &Path) -> anyhow::Result<u64> {
        self.inner.file_size(path).await
    }
}

#[async_trait::async_trait]
impl FileDirectoryInfra for DesktopInfra {
    async fn create_dirs(&self, path: &Path) -> anyhow::Result<()> {
        self.inner.create_dirs(path).await
    }
}

#[async_trait::async_trait]
impl CommandInfra for DesktopInfra {
    async fn execute_command(
        &self,
        command: String,
        working_dir: PathBuf,
        silent: bool,
        env_vars: Option<Vec<String>>,
    ) -> anyhow::Result<CommandOutput> {
        self.inner
            .execute_command(command, working_dir, silent, env_vars)
            .await
    }

    async fn execute_command_raw(
        &self,
        command: &str,
        working_dir: PathBuf,
        env_vars: Option<Vec<String>>,
    ) -> anyhow::Result<ExitStatus> {
        self.inner
            .execute_command_raw(command, working_dir, env_vars)
            .await
    }
}

#[async_trait::async_trait]
impl UserInfra for DesktopInfra {
    async fn prompt_question(&self, question: &str) -> anyhow::Result<Option<String>> {
        self.followups.prompt_question(question).await
    }

    async fn select_one<T: Clone + std::fmt::Display + Send + 'static>(
        &self,
        message: &str,
        options: Vec<T>,
    ) -> anyhow::Result<Option<T>> {
        self.followups.select_one(message, options).await
    }

    async fn select_many<T: std::fmt::Display + Clone + Send + 'static>(
        &self,
        message: &str,
        options: Vec<T>,
    ) -> anyhow::Result<Option<Vec<T>>> {
        self.followups.select_many(message, options).await
    }
}

#[async_trait::async_trait]
impl McpServerInfra for DesktopInfra {
    type Client = <ForgeInfra as McpServerInfra>::Client;

    async fn connect(
        &self,
        config: McpServerConfig,
        env_vars: &BTreeMap<String, String>,
        environment: &forge_domain::Environment,
    ) -> anyhow::Result<Self::Client> {
        self.inner.connect(config, env_vars, environment).await
    }
}

#[async_trait::async_trait]
impl WalkerInfra for DesktopInfra {
    async fn walk(&self, config: Walker) -> anyhow::Result<Vec<WalkedFile>> {
        self.inner.walk(config).await
    }
}

#[async_trait::async_trait]
impl HttpInfra for DesktopInfra {
    async fn http_get(&self, url: &Url, headers: Option<HeaderMap>) -> anyhow::Result<Response> {
        self.inner.http_get(url, headers).await
    }

    async fn http_post(
        &self,
        url: &Url,
        headers: Option<HeaderMap>,
        body: Bytes,
    ) -> anyhow::Result<Response> {
        self.inner.http_post(url, headers, body).await
    }

    async fn http_delete(&self, url: &Url) -> anyhow::Result<Response> {
        self.inner.http_delete(url).await
    }

    async fn http_eventsource(
        &self,
        url: &Url,
        headers: Option<HeaderMap>,
        body: Bytes,
    ) -> anyhow::Result<EventSource> {
        self.inner.http_eventsource(url, headers, body).await
    }
}

#[async_trait::async_trait]
impl DirectoryReaderInfra for DesktopInfra {
    async fn list_directory_entries(
        &self,
        directory: &Path,
    ) -> anyhow::Result<Vec<(PathBuf, bool)>> {
        self.inner.list_directory_entries(directory).await
    }

    async fn read_directory_files(
        &self,
        directory: &Path,
        pattern: Option<&str>,
    ) -> anyhow::Result<Vec<(PathBuf, String)>> {
        self.inner.read_directory_files(directory, pattern).await
    }
}

impl StrategyFactory for DesktopInfra {
    type Strategy = <ForgeInfra as StrategyFactory>::Strategy;

    fn create_auth_strategy(
        &self,
        provider_id: ProviderId,
        auth_method: AuthMethod,
        required_params: Vec<URLParamSpec>,
    ) -> anyhow::Result<Self::Strategy> {
        self.inner
            .create_auth_strategy(provider_id, auth_method, required_params)
    }
}

impl GrpcInfra for DesktopInfra {
    fn channel(&self) -> anyhow::Result<tonic::transport::Channel> {
        self.inner.channel()
    }

    fn hydrate(&self) {
        self.inner.hydrate();
    }
}

#[cfg(test)]
mod tests {
    use std::fmt::{Display, Formatter};
    use std::sync::{Mutex, MutexGuard};

    use forge_config::ForgeConfig;
    use forge_infra::ForgeInfra;
    use tempfile::TempDir;
    use tokio::time::{Duration, sleep};

    use super::*;
    use crate::dto::{FollowupKind, FollowupResponseDto};
    use crate::emitter::MemoryEventEmitter;

    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    struct EnvGuard {
        _lock: MutexGuard<'static, ()>,
    }

    impl EnvGuard {
        fn set_config_dir(path: &Path) -> Self {
            let lock = ENV_MUTEX.lock().expect("env mutex");
            unsafe { std::env::set_var("FORGE_CONFIG", path) };
            Self { _lock: lock }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            unsafe { std::env::remove_var("FORGE_CONFIG") };
        }
    }

    #[derive(Clone, Debug, PartialEq, Eq)]
    struct Choice {
        label: &'static str,
        value: &'static str,
    }

    impl Display for Choice {
        fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
            f.write_str(self.label)
        }
    }

    async fn build_fixture() -> (
        DesktopInfra,
        Arc<FollowupBridge>,
        MemoryEventEmitter,
        TempDir,
        EnvGuard,
    ) {
        let forge_home = tempfile::tempdir().expect("forge home");
        let workspace = tempfile::tempdir().expect("workspace");
        let env_guard = EnvGuard::set_config_dir(forge_home.path());
        let emitter = MemoryEventEmitter::default();
        let bridge = Arc::new(FollowupBridge::new(Arc::new(emitter.clone())));
        let infra = DesktopInfra::new(
            ForgeInfra::new(workspace.path().to_path_buf(), ForgeConfig::default()),
            bridge.clone(),
        );

        (infra, bridge, emitter, workspace, env_guard)
    }

    async fn wait_for_followup(emitter: &MemoryEventEmitter) -> crate::dto::FollowupRequestDto {
        for _ in 0..20 {
            if let Some(request) = emitter.followup_requests().last().cloned() {
                return request;
            }
            sleep(Duration::from_millis(10)).await;
        }

        panic!("timed out waiting for follow-up request");
    }

    #[tokio::test]
    async fn prompt_question_round_trips_text_input() {
        let (infra, bridge, emitter, _workspace, _guard) = build_fixture().await;

        let task = tokio::spawn({
            let infra = infra.clone();
            async move { infra.prompt_question("Provide input").await }
        });

        let request = wait_for_followup(&emitter).await;
        assert_eq!(request.kind, FollowupKind::Text);

        bridge
            .respond(FollowupResponseDto {
                followup_id: request.followup_id,
                cancelled: false,
                text: Some("answer".to_string()),
                selected_option_ids: None,
            })
            .await
            .expect("respond");

        assert_eq!(
            task.await.expect("join").expect("prompt"),
            Some("answer".to_string())
        );
    }

    #[tokio::test]
    async fn select_one_round_trips_duplicate_labels() {
        let (infra, bridge, emitter, _workspace, _guard) = build_fixture().await;

        let task = tokio::spawn({
            let infra = infra.clone();
            async move {
                infra
                    .select_one(
                        "Pick one",
                        vec![
                            Choice {
                                label: "Same",
                                value: "first",
                            },
                            Choice {
                                label: "Same",
                                value: "second",
                            },
                        ],
                    )
                    .await
            }
        });

        let request = wait_for_followup(&emitter).await;
        let selected_id = request
            .options
            .as_ref()
            .and_then(|options| options.last())
            .expect("option")
            .id
            .clone();

        bridge
            .respond(FollowupResponseDto {
                followup_id: request.followup_id,
                cancelled: false,
                text: None,
                selected_option_ids: Some(vec![selected_id]),
            })
            .await
            .expect("respond");

        let selected = task.await.expect("join").expect("select").expect("value");
        assert_eq!(selected.value, "second");
    }

    #[tokio::test]
    async fn select_many_round_trips_multiple_choices() {
        let (infra, bridge, emitter, _workspace, _guard) = build_fixture().await;

        let task = tokio::spawn({
            let infra = infra.clone();
            async move { infra.select_many("Pick many", vec!["a", "b", "c"]).await }
        });

        let request = wait_for_followup(&emitter).await;
        let selected = request
            .options
            .as_ref()
            .expect("options")
            .iter()
            .take(2)
            .map(|option| option.id.clone())
            .collect::<Vec<_>>();

        bridge
            .respond(FollowupResponseDto {
                followup_id: request.followup_id,
                cancelled: false,
                text: None,
                selected_option_ids: Some(selected),
            })
            .await
            .expect("respond");

        assert_eq!(
            task.await.expect("join").expect("select"),
            Some(vec!["a", "b"])
        );
    }

    #[tokio::test]
    async fn cancel_all_returns_none_for_pending_prompts() {
        let (infra, bridge, emitter, _workspace, _guard) = build_fixture().await;

        let task = tokio::spawn({
            let infra = infra.clone();
            async move { infra.prompt_question("Cancel me").await }
        });

        let request = wait_for_followup(&emitter).await;
        assert_eq!(request.kind, FollowupKind::Text);

        bridge.cancel_all().await;

        assert_eq!(task.await.expect("join").expect("prompt"), None);
    }
}
