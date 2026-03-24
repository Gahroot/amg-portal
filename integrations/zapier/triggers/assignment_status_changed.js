/**
 * Trigger: Assignment Status Changed
 *
 * Triggers when a partner assignment's status changes in AMG Portal.
 */

const triggerAssignmentStatusChanged = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.apiUrl}/api/v1/public/poll/assignments`,
    method: 'GET',
    params: {
      limit: 50,
      cursor: bundle.meta?.page || undefined,
    },
  });

  const data = response.json;

  // Filter to only return assignments that have been updated
  return data.results
    .filter((assignment) => assignment.updated_at !== assignment.created_at)
    .map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      status: assignment.status,
      program_id: assignment.program_id,
      due_date: assignment.due_date,
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
    }));
};

module.exports = {
  key: 'assignment_status_changed',
  noun: 'Assignment',

  display: {
    label: 'Assignment Status Changed',
    description: 'Triggers when an assignment status is updated.',
  },

  operation: {
    type: 'polling',

    inputFields: [
      {
        key: 'status',
        label: 'Filter by Status',
        type: 'string',
        required: false,
        choices: [
          'dispatched',
          'accepted',
          'in_progress',
          'submitted',
          'review',
          'completed',
          'cancelled',
        ],
        helpText: 'Only trigger when status changes to this value.',
      },
    ],

    perform: triggerAssignmentStatusChanged,

    sample: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Travel arrangement for Paris trip',
      status: 'completed',
      program_id: '123e4567-e89b-12d3-a456-426614174002',
      due_date: '2024-03-20',
      created_at: '2024-03-01T11:00:00Z',
      updated_at: '2024-03-05T16:45:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Assignment ID', type: 'string' },
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'program_id', label: 'Program ID', type: 'string' },
      { key: 'due_date', label: 'Due Date', type: 'datetime' },
    ],
  },
};
