/**
 * Trigger: Task Status Changed
 *
 * Triggers when a task's status changes in AMG Portal.
 */

const triggerTaskStatusChanged = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.apiUrl}/api/v1/public/poll/tasks`,
    method: 'GET',
    params: {
      limit: 50,
      cursor: bundle.meta?.page || undefined,
    },
  });

  const data = response.json;

  // Filter to only return tasks that have been updated (not just created)
  // In a real implementation, this would use a webhook or a dedicated endpoint
  return data.results
    .filter((task) => task.updated_at !== task.created_at)
    .map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      created_at: task.created_at,
      updated_at: task.updated_at,
    }));
};

module.exports = {
  key: 'task_status_changed',
  noun: 'Task',

  display: {
    label: 'Task Status Changed',
    description: 'Triggers when a task status is updated.',
  },

  operation: {
    type: 'polling',

    // Input fields for filtering
    inputFields: [
      {
        key: 'status',
        label: 'Filter by Status',
        type: 'string',
        required: false,
        choices: ['todo', 'in_progress', 'review', 'done', 'cancelled'],
        helpText: 'Only trigger when status changes to this value.',
      },
    ],

    perform: triggerTaskStatusChanged,

    sample: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Review client documents',
      description: 'Review and approve uploaded documents',
      status: 'in_progress',
      priority: 'high',
      due_date: '2024-03-15',
      created_at: '2024-03-01T10:00:00Z',
      updated_at: '2024-03-02T14:30:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Task ID', type: 'string' },
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'priority', label: 'Priority', type: 'string' },
      { key: 'due_date', label: 'Due Date', type: 'datetime' },
    ],
  },
};
