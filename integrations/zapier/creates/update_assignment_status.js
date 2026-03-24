/**
 * Action: Update Assignment Status
 *
 * Updates the status of a partner assignment in AMG Portal.
 */

const updateAssignmentStatus = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.apiUrl}/api/v1/public/assignments/${bundle.inputData.assignment_id}/status`,
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
    throw new Error(`Failed to update assignment status: ${response.content}`);
  }

  return response.json;
};

module.exports = {
  key: 'update_assignment_status',
  noun: 'Assignment',

  display: {
    label: 'Update Assignment Status',
    description: 'Updates the status of a partner assignment.',
  },

  operation: {
    inputFields: [
      {
        key: 'assignment_id',
        label: 'Assignment ID',
        type: 'string',
        required: true,
        helpText: 'The ID of the assignment to update.',
      },
      {
        key: 'status',
        label: 'New Status',
        type: 'string',
        required: true,
        choices: [
          'dispatched',
          'accepted',
          'in_progress',
          'submitted',
          'review',
          'completed',
          'cancelled',
        ],
        helpText: 'The new status for the assignment.',
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        required: false,
        helpText: 'Optional notes about the status change.',
      },
    ],

    perform: updateAssignmentStatus,

    sample: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'completed',
      updated_at: '2024-03-05T16:45:00Z',
      message: 'Status updated successfully',
    },

    outputFields: [
      { key: 'id', label: 'Assignment ID', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'updated_at', label: 'Updated At', type: 'datetime' },
    ],
  },
};
