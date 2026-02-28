# Follow-up System API Documentation

## Base URL
```
https://crmbackend-469714.el.r.appspot.com/api/followup
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Campaign Management

### Create Campaign
```http
POST /campaigns
Content-Type: application/json

{
  "name": "Welcome Campaign",
  "subject": "Welcome to our platform!",
  "template": "template_id_here",
  "contacts": ["contact_id_1", "contact_id_2"],
  "contactLists": ["list_id_1"],
  "settings": {
    "trackOpens": true,
    "trackClicks": true,
    "enableFollowups": true,
    "followupDelay": 3,
    "maxFollowups": 3
  }
}
```

### Get Campaigns
```http
GET /campaigns?page=1&limit=10&search=welcome&status=draft
```

### Get Campaign by ID
```http
GET /campaigns/:campaignId
```

### Update Campaign
```http
PUT /campaigns/:campaignId
Content-Type: application/json

{
  "name": "Updated Campaign Name",
  "status": "scheduled"
}
```

### Delete Campaign
```http
DELETE /campaigns/:campaignId
```

### Start Campaign
```http
POST /campaigns/:campaignId/start
```

## Contact Management

### Create Contact
```http
POST /contacts
Content-Type: application/json

{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "company": "Tech Corp",
  "position": "Manager",
  "phone": "+1234567890",
  "tags": ["prospect", "tech"],
  "customFields": {
    "source": "website",
    "interest": "product-demo"
  }
}
```

### Get Contacts
```http
GET /contacts?page=1&limit=10&search=john&status=active&listId=list_id_here
```

### Update Contact
```http
PUT /contacts/:contactId
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "company": "New Company"
}
```

### Delete Contact
```http
DELETE /contacts/:contactId
```

### Bulk Create Contacts
```http
POST /contacts/bulk
Content-Type: application/json

{
  "contacts": [
    {
      "email": "contact1@example.com",
      "firstName": "Contact",
      "lastName": "One"
    },
    {
      "email": "contact2@example.com",
      "firstName": "Contact",
      "lastName": "Two"
    }
  ]
}
```

## Contact List Management

### Create Contact List
```http
POST /contact-lists
Content-Type: application/json

{
  "name": "Prospects",
  "description": "All prospect contacts",
  "tags": ["prospects", "leads"]
}
```

### Get Contact Lists
```http
GET /contact-lists?page=1&limit=10&search=prospects
```

### Update Contact List
```http
PUT /contact-lists/:listId
Content-Type: application/json

{
  "name": "Updated List Name",
  "description": "Updated description"
}
```

### Delete Contact List
```http
DELETE /contact-lists/:listId
```

### Add Contacts to List
```http
POST /contact-lists/:listId/contacts
Content-Type: application/json

{
  "contactIds": ["contact_id_1", "contact_id_2", "contact_id_3"]
}
```

## Template Management

### Create Template
```http
POST /templates
Content-Type: application/json

{
  "name": "Welcome Template",
  "subject": "Welcome to our platform!",
  "htmlContent": "<h1>Welcome!</h1><p>Thank you for joining us.</p>",
  "textContent": "Welcome! Thank you for joining us.",
  "type": "initial",
  "variables": [
    {
      "name": "firstName",
      "defaultValue": "User",
      "description": "Contact's first name"
    }
  ]
}
```

### Get Templates
```http
GET /templates?page=1&limit=10&search=welcome&type=initial
```

### Update Template
```http
PUT /templates/:templateId
Content-Type: application/json

{
  "name": "Updated Template Name",
  "subject": "Updated Subject"
}
```

### Delete Template
```http
DELETE /templates/:templateId
```

## Follow-up Management

### Create Follow-up
```http
POST /followups
Content-Type: application/json

{
  "campaignId": "campaign_id_here",
  "originalEmailId": "email_id_here",
  "contactId": "contact_id_here",
  "templateId": "template_id_here",
  "sequence": 1,
  "scheduledAt": "2024-01-15T10:00:00Z",
  "conditions": {
    "requireOpen": true,
    "requireClick": false,
    "requireNoReply": true
  }
}
```

### Get Follow-ups
```http
GET /followups?page=1&limit=10&status=scheduled&campaignId=campaign_id_here
```

### Update Follow-up
```http
PUT /followups/:followupId
Content-Type: application/json

{
  "scheduledAt": "2024-01-16T10:00:00Z",
  "conditions": {
    "requireOpen": false,
    "requireClick": true,
    "requireNoReply": true
  }
}
```

### Delete Follow-up
```http
DELETE /followups/:followupId
```

## Analytics

### Get Campaign Stats
```http
GET /campaigns/:campaignId/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "totalEmails": 100,
    "totalFollowups": 30,
    "sentEmails": 95,
    "sentFollowups": 25,
    "openedEmails": 45,
    "clickedEmails": 15,
    "repliedEmails": 8,
    "bouncedEmails": 2,
    "unsubscribed": 1
  }
}
```

## Admin Operations

### Process Scheduled Follow-ups
```http
POST /admin/process-followups
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## Pagination

All list endpoints support pagination with the following query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

## Search and Filtering

Most endpoints support search and filtering:
- `search` - Search term for text fields
- `status` - Filter by status
- `type` - Filter by type (for templates)
- `campaignId` - Filter by campaign (for follow-ups)
- `listId` - Filter by contact list (for contacts)

## Follow-up Conditions

Follow-ups can be configured with specific conditions:
- `requireOpen` - Only send if original email was opened
- `requireClick` - Only send if original email was clicked
- `requireNoReply` - Only send if no reply was received

## Campaign Settings

Campaigns can be configured with various settings:
- `trackOpens` - Track email opens
- `trackClicks` - Track email clicks
- `enableFollowups` - Enable automatic follow-ups
- `followupDelay` - Days between follow-ups
- `maxFollowups` - Maximum number of follow-ups per contact 