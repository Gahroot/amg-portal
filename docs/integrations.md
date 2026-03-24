# AMG Portal Integrations

Connect AMG Portal with your favorite automation platforms and external services.

## Overview

AMG Portal provides a robust public API and webhook system for integrating with external automation platforms like Zapier and Make (Integromat). This enables you to:

- **Automate workflows** - Trigger actions when events occur in AMG Portal
- **Sync data** - Keep your tools in sync with AMG Portal data
- **Extend functionality** - Add custom behaviors using external services

## Getting Started

### 1. Create an API Key

Before connecting any integration, you need an API key:

1. Log into AMG Portal
2. Navigate to **Settings > API Keys**
3. Click **Create API Key**
4. Give it a descriptive name (e.g., "Zapier Integration")
5. Select the required scopes:
   - `tasks:read` - Read tasks
   - `tasks:write` - Create/update tasks
   - `assignments:read` - Read assignments
   - `assignments:write` - Update assignment status
   - `webhooks:manage` - Manage webhook subscriptions
6. Copy the API key immediately - it won't be shown again!

### 2. Choose Your Integration Method

| Method | Best For | Complexity |
|--------|----------|------------|
| **Zapier** | Quick integrations with 6000+ apps | Easy |
| **Make** | Complex multi-step workflows | Medium |
| **Direct API** | Custom integrations | Advanced |
| **Webhooks** | Real-time notifications | Intermediate |

---

## Zapier Integration

### What You Can Do

**Triggers (When this happens...):**
- New Task Created
- New Assignment Created
- Task Status Changed
- Assignment Status Changed

**Actions (Do this...):**
- Create Task
- Update Task Status
- Update Assignment Status

### Setting Up Zapier

1. Go to [Zapier](https://zapier.com) and create an account
2. Create a new Zap
3. Search for "AMG Portal" (or use the Webhooks by Zapier app)
4. Connect your account:
   - **API URL**: `https://api.amg-portal.com`
   - **API Key**: Your API key from step 1
5. Configure your trigger or action
6. Test and activate your Zap

### Example Zapier Workflows

#### New Task → Slack Notification
```
Trigger: New Task in AMG Portal
Action: Send Channel Message in Slack
  - Channel: #operations
  - Message: "New task: {{title}} - Priority: {{priority}}"
```

#### Task Completed → Google Sheets Row
```
Trigger: Task Status Changed (status = "done")
Action: Create Spreadsheet Row in Google Sheets
  - Columns: Task ID, Title, Completed Date
```

#### Form Submission → Create Task
```
Trigger: New Form Response (Typeform/Google Forms)
Action: Create Task in AMG Portal
  - Title: {{form_response.summary}}
  - Description: {{form_response.details}}
  - Priority: "medium"
```

---

## Make (Integromat) Integration

### Setting Up Make

1. Go to [Make](https://make.com) and create an account
2. Create a new scenario
3. Add an HTTP module with:
   - **URL**: Your AMG Portal API endpoint
   - **Headers**: `X-API-Key: your-api-key`
4. Configure the action and connect additional modules
5. Set up scheduling (e.g., every 15 minutes)
6. Activate the scenario

### Make Scenario Templates

We provide pre-built templates in the `integrations/make/scenarios/` folder:

| Template | Description |
|----------|-------------|
| `new-task-to-slack.json` | Post new tasks to Slack |
| `new-assignment-to-email.json` | Email notifications for new assignments |
| `webhook-receiver.json` | Receive and route webhooks |

### Using Webhooks with Make

1. Add a **Webhook** module to your scenario
2. Copy the webhook URL
3. In AMG Portal, create a webhook subscription with this URL
4. Configure event types to receive
5. Add a **Router** module to handle different event types

---

## Direct API Integration

For custom integrations, use our public API directly.

### Base URL

```
Production: https://api.amg-portal.com/api/v1/public
Development: http://localhost:8000/api/v1/public
```

### Authentication

Include your API key in all requests:

```http
GET /api/v1/public/poll/tasks HTTP/1.1
Host: api.amg-portal.com
X-API-Key: amg_your_api_key_here
```

### API Endpoints

#### API Information
```http
GET /api/v1/public
```

Returns API version and available event types.

#### List Event Types
```http
GET /api/v1/public/event-types
```

#### Test Connection
```http
POST /api/v1/public/test
```

Validates your API key and returns user info.

#### Poll Tasks
```http
GET /api/v1/public/poll/tasks?limit=50&cursor=2024-01-01T00:00:00Z
```

Parameters:
- `limit` (int): Number of results (1-100, default 50)
- `cursor` (string): ISO timestamp for pagination

#### Poll Assignments
```http
GET /api/v1/public/poll/assignments?limit=50&cursor=2024-01-01T00:00:00Z
```

#### Create Task
```http
POST /api/v1/public/tasks
Content-Type: application/json

{
  "title": "Review documents",
  "description": "Review uploaded client documents",
  "program_id": "uuid",
  "priority": "high",
  "due_date": "2024-03-15"
}
```

#### Update Task Status
```http
PATCH /api/v1/public/tasks/{task_id}/status
Content-Type: application/json

{
  "status": "in_progress",
  "notes": "Starting review"
}
```

#### Update Assignment Status
```http
PATCH /api/v1/public/assignments/{assignment_id}/status
Content-Type: application/json

{
  "status": "completed",
  "notes": "All deliverables submitted"
}
```

---

## Webhooks

### Outbound Webhooks

AMG Portal can send webhooks to your endpoints when events occur.

#### Creating a Webhook Subscription

```http
POST /api/v1/public/webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/amg",
  "events": ["task.created", "assignment.completed"],
  "description": "Production webhook"
}
```

Response:
```json
{
  "id": "uuid",
  "url": "https://your-app.com/webhooks/amg",
  "events": ["task.created", "assignment.completed"],
  "secret": "whsec_xxxx...",  // Store this for verification!
  "is_active": true,
  "created_at": "2024-03-01T00:00:00Z"
}
```

#### Webhook Payload Format

```json
{
  "id": "evt_xxx",
  "event_type": "task.created",
  "timestamp": "2024-03-01T10:00:00Z",
  "data": {
    "id": "task-uuid",
    "title": "New Task",
    "status": "todo",
    "priority": "high",
    ...
  },
  "actor": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "relationship_manager"
  }
}
```

#### Verifying Webhook Signatures

AMG Portal signs webhook payloads using HMAC-SHA256. Verify the signature:

```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    # Parse signature header: t=timestamp,v1=signature
    parts = dict(p.split('=') for p in signature.split(','))
    timestamp = parts['t']
    expected_sig = parts['v1']

    # Compute signature
    signed_payload = f"{timestamp}.{payload.decode()}"
    computed_sig = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(computed_sig, expected_sig)
```

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const parts = Object.fromEntries(
    signature.split(',').map(p => p.split('='))
  );
  const timestamp = parts.t;
  const expectedSig = parts.v1;

  const signedPayload = `${timestamp}.${payload}`;
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return computedSig === expectedSig;
}
```

### Inbound Webhooks

External services can send data to AMG Portal via inbound webhooks:

```http
POST /api/v1/public/inbound/{webhook_token}
Content-Type: application/json

{
  "action": "create_task",
  "data": {
    "title": "Task from external service",
    "priority": "medium"
  }
}
```

---

## Event Types Reference

| Event Type | Description | Data Included |
|------------|-------------|---------------|
| `task.created` | New task created | Full task object |
| `task.updated` | Task updated | Updated task object |
| `task.completed` | Task marked complete | Task with completion info |
| `assignment.created` | New assignment created | Full assignment object |
| `assignment.status_changed` | Assignment status changed | Assignment with new status |
| `assignment.completed` | Assignment completed | Assignment with completion info |
| `program.created` | New program created | Program object |
| `program.status_changed` | Program status changed | Program with new status |
| `document.uploaded` | Document uploaded | Document metadata |
| `document.approved` | Document approved | Document with approval info |
| `deliverable.submitted` | Deliverable submitted | Deliverable object |
| `deliverable.approved` | Deliverable approved | Deliverable with approval info |

---

## Rate Limits

| Endpoint Category | Rate Limit |
|-------------------|------------|
| Polling endpoints | 60 requests/minute |
| Action endpoints | 120 requests/minute |
| Webhook delivery | 10 retries with exponential backoff |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

---

## Best Practices

1. **Store secrets securely** - Never commit API keys or webhook secrets to version control
2. **Use webhook signatures** - Always verify incoming webhooks
3. **Handle pagination** - Use cursors for large data sets
4. **Implement retries** - Use exponential backoff for failed requests
5. **Log for debugging** - Keep logs of API calls for troubleshooting
6. **Use descriptive names** - Name your API keys and webhooks clearly
7. **Rotate keys regularly** - Regenerate API keys periodically

---

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check that your API key is correct
- Ensure the key hasn't expired or been revoked
- Verify the `X-API-Key` header is set correctly

**403 Forbidden**
- Your API key may not have the required scope
- Check if your user account is still active

**404 Not Found**
- Verify the endpoint URL is correct
- Check that the resource ID exists

**429 Too Many Requests**
- You've hit the rate limit
- Wait for the reset time and retry with exponential backoff

### Getting Help

- Check the [API Documentation](/api/v1/docs)
- Review webhook delivery logs in AMG Portal
- Contact support at support@amg-portal.com

---

## Security Considerations

1. **API Keys** - Treat API keys like passwords. Never share them or commit to version control.
2. **Webhook Secrets** - Store webhook secrets securely and use them to verify signatures.
3. **HTTPS Only** - All API communication must use HTTPS.
4. **Scope Limitation** - Request only the minimum scopes needed for your integration.
5. **Key Rotation** - Rotate API keys periodically, especially if there's any suspicion of compromise.
