/**
 * Trigger: New Task
 *
 * Triggers when a new task is created in AMG Portal.
 */

const triggerNewTask = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.apiUrl}/api/v1/public/poll/tasks`,
    method: 'GET',
    params: {
      limit: 50,
      cursor: bundle.meta?.page || undefined,
    },
  });

  const data = response.json;

  // Return the results (Zapier will dedupe based on id)
  return data.results.map((task) => ({
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
  key: 'new_task',
  noun: 'Task',

  display: {
    label: 'New Task',
    description: 'Triggers when a new task is created.',
  },

  operation: {
    type: 'polling',

    perform: triggerNewTask,

    // Sample data shown when setting up the Zap
    sample: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Review client documents',
      description: 'Review and approve uploaded documents',
      status: 'todo',
      priority: 'high',
      due_date: '2024-03-15',
      created_at: '2024-03-01T10:00:00Z',
      updated_at: '2024-03-01T10:00:00Z',
    },

    // Output fields for mapping
    outputFields: [
      { key: 'id', label: 'Task ID', type: 'string' },
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'priority', label: 'Priority', type: 'string' },
      { key: 'due_date', label: 'Due Date', type: 'datetime' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
    ],
  },
};
