/**
 * Trigger: New Assignment
 *
 * Triggers when a new partner assignment is created in AMG Portal.
 */

const triggerNewAssignment = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.apiUrl}/api/v1/public/poll/assignments`,
    method: 'GET',
    params: {
      limit: 50,
      cursor: bundle.meta?.page || undefined,
    },
  });

  const data = response.json;

  return data.results.map((assignment) => ({
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
  key: 'new_assignment',
  noun: 'Assignment',

  display: {
    label: 'New Assignment',
    description: 'Triggers when a new assignment is created.',
  },

  operation: {
    type: 'polling',

    perform: triggerNewAssignment,

    sample: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Travel arrangement for Paris trip',
      status: 'dispatched',
      program_id: '123e4567-e89b-12d3-a456-426614174002',
      due_date: '2024-03-20',
      created_at: '2024-03-01T11:00:00Z',
      updated_at: '2024-03-01T11:00:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Assignment ID', type: 'string' },
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'program_id', label: 'Program ID', type: 'string' },
      { key: 'due_date', label: 'Due Date', type: 'datetime' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
    ],
  },
};
