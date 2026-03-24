# AMG Portal Make (Integromat) Integration

This folder contains templates and documentation for integrating AMG Portal with Make (formerly Integromat).

## Quick Start

1. **Create an API Key**
   - Log into AMG Portal
   - Go to Settings > API Keys
   - Create a new API key with the required scopes

2. **Create a Make Scenario**
   - Log into Make (make.com)
   - Create a new scenario
   - Add a webhook or HTTP module

3. **Configure Authentication**
   - Add a header: `X-API-Key: your-api-key`
   - Set base URL: `https://api.amg-portal.com/api/v1/public`

## Available Endpoints

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks` | POST | Create webhook subscription |
| `/webhooks` | GET | List your webhooks |
| `/webhooks/{id}` | DELETE | Delete a webhook |

### Polling

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/poll/tasks` | GET | Poll for new/updated tasks |
| `/poll/assignments` | GET | Poll for new/updated assignments |

### Actions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks` | POST | Create a new task |
| `/tasks/{id}/status` | PATCH | Update task status |
| `/assignments/{id}/status` | PATCH | Update assignment status |

## Event Types

- `task.created` - New task created
- `task.updated` - Task updated
- `task.completed` - Task marked complete
- `assignment.created` - New assignment created
- `assignment.status_changed` - Assignment status changed
- `assignment.completed` - Assignment completed
- `program.created` - New program created
- `program.status_changed` - Program status changed
- `document.uploaded` - Document uploaded
- `document.approved` - Document approved
- `deliverable.submitted` - Deliverable submitted
- `deliverable.approved` - Deliverable approved

## Webhook Signature Verification

When receiving webhooks, verify the signature:

```
X-AMG-Signature: t=<timestamp>,v1=<signature>
```

Verify by computing HMAC-SHA256 of `<timestamp>.<payload>` with your webhook secret.
