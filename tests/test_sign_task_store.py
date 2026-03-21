from __future__ import annotations

from backend.contracts.dtos import SignTaskDefinition


def _task(name: str, account_name: str) -> SignTaskDefinition:
    return SignTaskDefinition(
        name=name,
        account_name=account_name,
        sign_at="0 8 * * *",
        chats=[],
        random_seconds=0,
        sign_interval=5,
        enabled=True,
        execution_mode="fixed",
        range_start="",
        range_end="",
    )


def test_filtered_queries_do_not_poison_global_sign_task_cache(isolated_env):
    from backend.stores.sign_tasks import get_sign_task_store

    store = get_sign_task_store()
    store.save_task(_task("task-a", "V1"))
    store.save_task(_task("task-b", "V2"))

    filtered = store.list_tasks(account_name="V1")
    all_tasks = store.list_tasks()

    assert [task.name for task in filtered] == ["task-a"]
    assert {(task.account_name, task.name) for task in all_tasks} == {
        ("V1", "task-a"),
        ("V2", "task-b"),
    }
