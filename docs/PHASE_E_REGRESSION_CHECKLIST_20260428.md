# Phase E Regression Checklist (Creative Xiaohai)

Use this checklist in sandbox after each major release.

## A. Session and Task Continuity

- [ ] Start a new Creative Xiaohai session and send a normal prompt.
- [ ] Confirm one `worker_tasks` record is created and appears in right-side task panel.
- [ ] Switch to another page/tab immediately after sending, wait 20-60s, return to chat page.
- [ ] Confirm task status updates from `running` to terminal state (`succeeded`/`partial_succeeded`/`failed`) without manual refresh.
- [ ] Confirm a system message is appended for terminal status transition.

## B. Batch Generation (3 Images / Videos)

- [ ] Trigger a batch generation flow (3 items minimum).
- [ ] Confirm batch API returns a `worker_task_id`.
- [ ] Confirm `worker_task_items` has 3+ rows for parent task.
- [ ] Confirm parent task status aggregates from item statuses.
- [ ] Switch window during execution and return later; verify item count and final state unchanged.

## C. Replay and Session Isolation

- [ ] For a completed task in current session, click "查看" and confirm outputs replay into message list.
- [ ] Confirm replay syncs `conversationHistory` (follow-up prompt should reference replayed context).
- [ ] For a task from a different session, click "查看" and confirm UI shows session mismatch warning instead of cross-session replay.

## D. Idempotency and Retry

- [ ] Submit the same request twice quickly (same UI send action path).
- [ ] Confirm no duplicate parent task for same `clientRequestId`.
- [ ] Force one failed task and use retry.
- [ ] Confirm task resets to `queued` then progresses again.

## E. Memory Confirmation Governance

- [ ] Trigger memory confirmation once, choose "以后别再问".
- [ ] Send another preference-like sentence.
- [ ] Confirm no new `memory_candidate` card is emitted.

## F. Video Library and Tag Filtering

- [ ] Add different tags to different videos.
- [ ] Confirm tag dropdown includes newly used tags.
- [ ] Select one tag and confirm cross-source merged list is correctly filtered.

## G. DB Consistency Quick Queries

Run after scenario tests:

```sql
-- 1) Task state distribution
select status, count(*) from worker_tasks group by status order by status;

-- 2) Parent-child integrity
select wt.id, wt.status, count(wti.*) as item_count
from worker_tasks wt
left join worker_task_items wti on wti.task_id = wt.id
group by wt.id, wt.status
order by wt.created_at desc
limit 20;

-- 3) Index health
select indexname from pg_indexes
where schemaname='public'
  and tablename in ('worker_tasks','worker_task_items')
order by tablename, indexname;
```

## Exit Criteria

- [ ] No task disappears from panel after page switch.
- [ ] No cross-session replay pollution.
- [ ] Batch tasks maintain full item visibility and final aggregation.
- [ ] No duplicate parent tasks for same request id.
- [ ] Memory opt-out respected.
- [ ] Tag filter behavior deterministic.
