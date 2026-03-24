/**
 * Action: Update Task Status
 *
 * Updates the status of an existing task in AMG Portal.
 */

const updateTaskStatus = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.apiUrl}/api/v1/public/tasks/${bundle.inputData.task_id}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      status: bundle.inputData.status,
      notes: bundle.inputData.notes,
    },
  });

  if (response.status !== 200) {
    throw new Error(`Failed to update task status: ${response.content}`);
  }

  return response.json;
};

module.exports = {
  key: 'update_task_status',
  noun: 'Task',

  display: {
    label: 'Update Task Status',
    description: 'Updates the status of an existing task.',
  },

  operation: {
    inputFields: [
      {
        key: 'task_id',
        label: 'Task ID',
        type: 'string',
        required: true,
        helpText: 'The ID of the task to update.',
      },
      {
        key: 'status',
        label: 'New Status',
        type: 'string',
        required: true,
        choices: ['todo', 'in_progress', 'review', 'done', 'cancelled'],
        helpText: 'The new status for the task.',
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        required: false,
        helpText: 'Optional notes about the status change.',
      },
    ],

    perform: updateTaskStatus,

    sample: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'in_progress',
      updated_at: '2024-03-02T14:30:00Z',
      message: 'Status updated successfully',
    },

    outputFields: [
      { key: 'id', label: 'Task ID', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
