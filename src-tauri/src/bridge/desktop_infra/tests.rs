use std::fmt::{Display, Formatter};
use std::sync::Arc;

use forge_app::UserInfra;
use forge_config::ForgeConfig;
use forge_infra::ForgeInfra;
use tempfile::TempDir;
use tokio::time::{Duration, sleep};

use super::DesktopInfra;
use crate::bridge::emitter::MemoryEventEmitter;
use crate::bridge::followup::FollowupBridge;
use crate::dto::{FollowupKind, FollowupRequestDto, FollowupResponseDto};
use crate::test_support::EnvGuard;

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

async fn wait_for_followup(emitter: &MemoryEventEmitter) -> FollowupRequestDto {
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
