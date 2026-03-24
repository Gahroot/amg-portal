/**
 * AMG Portal Zapier Integration
 *
 * This integration allows you to connect AMG Portal with 6000+ apps via Zapier.
 * It supports triggers for events and actions for creating/updating records.
 */

const authentication = require('./authentication');
const newTask = require('./triggers/new_task');
const newAssignment = require('./triggers/new_assignment');
const taskStatusChanged = require('./triggers/task_status_changed');
const assignmentStatusChanged = require('./triggers/assignment_status_changed');
const createTask = require('./creates/create_task');
const updateTaskStatus = require('./creates/update_task_status');
const updateAssignmentStatus = require('./creates/update_assignment_status');

// Include the auth header in all requests
const includeApiKey = (request, z, bundle) => {
  if (bundle.authData.apiKey) {
    request.headers['X-API-Key'] = bundle.authData.apiKey;
  }
  return request;
};

// Handle errors from the API
const handleErrors = (response, z, bundle) => {
  if (response.status === 401) {
    throw new z.errors.Error(
      'Invalid API key. Please check your credentials.',
      'AuthenticationError',
      response.status
    );
  }
  if (response.status === 403) {
    throw new z.errors.Error(
      'You do not have permission to perform this action.',
      'PermissionError',
      response.status
    );
  }
  if (response.status === 429) {
    throw new z.errors.Error(
      'Rate limit exceeded. Please try again later.',
      'RateLimitError',
      response.status
    );
  }
  return response;
};

// App definition
module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  // Authentication configuration
  authentication: authentication,

  // Before request middleware
  beforeRequest: [includeApiKey],

  // After response middleware
  afterResponse: [handleErrors],

  // Triggers - events that start a Zap
  triggers: {
    [newTask.key]: newTask,
    [newAssignment.key]: newAssignment,
    [taskStatusChanged.key]: taskStatusChanged,
    [assignmentStatusChanged.key]: assignmentStatusChanged,
  },

  // Actions - things the Zap can do
  creates: {
    [createTask.key]: createTask,
    [updateTaskStatus.key]: updateTaskStatus,
    [updateAssignmentStatus.key]: updateAssignmentStatus,
  },

  // Searches - find existing records (not implemented yet)
  searches: {},

  // Resources - reusable object definitions (not implemented yet)
  resources: {},
};
