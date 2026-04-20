# Revelo Data Model — Members · Accounts · Jobs · Tasks

> See [revelo-data-model.svg](./revelo-data-model.svg) for the visual diagram.

---

## Entity Overview

```
User (Member)
 └── owns many ReveloAccounts
      └── ReveloAccount  ◄──many-to-many──►  ReveloJob
                                                  └── ReveloTask         (individual task record)
                                                  └── ReveloTaskBalance  (batch count entry)
```

---

## Schemas

### User
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `username` | String | |
| `displayName` | String | |
| `avatarUrl` | String | |

---

### ReveloAccount
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `userId` | → User | owner |
| `name` | String | |
| `nationality` | String | |
| `connectionType` | `proxy` \| `remote_pc` | |
| `proxyDetail` | `{ host, port, account, password, protocol }` | when proxy |
| `remotePc` | `{ holderName, nationality }` | when remote PC |
| `paymentDetails` | `{ idVerified, paymentVerified, bankHoldingStatus, revenueSharePercentage }` | |
| `statuses` | String[] | `fresh_new`, `open_jobs`, `approved_tasks`, `payment_attached`, `earned_money`, `suspended` |

---

### ReveloJob
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `creatorId` | → User | who created the job |
| `accountIds` | → ReveloAccount[] | **many-to-many join lives here** |
| `jobName` | String | |
| `hourlyRate` | Number | $/hr |
| `jobMaxPayableTime` | Number | hours per task |
| `jobMaxDuration` | Number | |
| `jobExpectedTime` | Number | |
| `term` | `short` \| `long` | |
| `learningCurve` | Boolean | |
| `status` | `active` \| `paused` \| `archived` | |
| `startDate` | Date | |
| `leaders` | String[] | |
| `assets` | Attachment[] | |
| `editRequests` | EditRequest[] | pending change requests |

---

### ReveloTask  *(individual task record)*
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `userId` | → User | scoping key |
| `accountId` | → ReveloAccount | scoping key |
| `jobId` | → ReveloJob | scoping key |
| `taskUuid` | String | external task ID |
| `duration` | String | |
| `comment` | String | |
| `feedback` | String | |
| `startDate` | Date | |
| `attachments` | Attachment[] | |
| `status` | `started` \| `submitted` \| `rejected` \| `rejected_redo` \| `below_expectation` \| `meet_expectation` \| `above_expectation` | full lifecycle |

---

### ReveloTaskBalance  *(batch count entry)*
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `userId` | → User | scoping key |
| `accountId` | → ReveloAccount | scoping key |
| `jobId` | → ReveloJob | scoping key |
| `type` | `submitted` \| `approved` \| `rejected` | |
| `count` | Number | batch quantity (e.g. "5 tasks today") |
| `cost` | Number? | explicit override; if null → derived |
| `note` | String | |

---

## Relationship Table

| Relationship | Cardinality | Mechanism |
|---|---|---|
| User → Account | **1 : N** | `Account.userId` |
| Account ↔ Job | **M : N** | `Job.accountIds[]` — join lives on Job |
| User → Job (creator) | **1 : N** | `Job.creatorId` |
| User + Account + Job → Task | **scoped 3-way** | `Task.{ userId, accountId, jobId }` |
| User + Account + Job → TaskBalance | **scoped 3-way** | `TaskBalance.{ userId, accountId, jobId }` |

---

## Key Design Decisions

### Many-to-Many (Account ↔ Job)
The link is stored as `accountIds[]` on the Job document. A single job can appear under multiple accounts. Because of this, every task query **must always scope by `(userId, accountId, jobId)` together** — scoping by `jobId` alone causes tasks from Account A to bleed into Account B's view.

### Two Parallel Task Systems
| | ReveloTask | ReveloTaskBalance |
|---|---|---|
| Purpose | Track the actual work unit | Track batch counts for reporting |
| Granularity | One record per task | One record per "batch" entry |
| Status | Full lifecycle (7 states) | submitted / approved / rejected |
| Used by | Tasks page | Dashboard, Tree View, Task Balance page |

### Cost Calculation Priority
```
1. entry.cost                                   (explicit override)
2. count × job.hourlyRate × job.jobMaxPayableTime  (derived from job rates)
3. null                                         (no cost data)
```
