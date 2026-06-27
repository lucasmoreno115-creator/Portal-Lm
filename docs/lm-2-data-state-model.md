# LM 2.0 — Data and State Model

## Foundation State

The initial client-side state contains only the minimum fields required to scaffold the journey:

| Field | Initial value | Purpose |
| --- | --- | --- |
| `onboarding_completed` | `false` | Indicates whether the user has completed LM 2.0 onboarding. |
| `current_week` | `1` | Tracks the current program week. |
| `continuity_days_count` | `0` | Counts completed continuity days in the current 7-day window. |
| `required_days_count` | `5` | Defines the 5-of-7 advancement rule. |
| `next_action` | `start_onboarding` | Identifies the next guided action. |

## Out of Scope for Foundation

- Database schema.
- API contracts.
- Authentication or access changes.
- Cross-device persistence.
- Progress calculations beyond the initial scaffold fields.
