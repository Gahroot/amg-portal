/**
 * Action: Create Task
 *
 * Creates a new task in AMG Portal.
 */

const createTask = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.apiUrl}/api/v1/public/tasks`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      title: bundle.inputData.title,
      description: bundle.inputData.description,
      program_id: bundle.inputData.program_id,
      milestone_id: bundle.inputData.milestone_id,
      priority: bundle.inputData.priority || 'medium',
      due_date: bundle.inputData.due_date,
      assigned_to_id: bundle.inputData.assigned_to_id,
    },
  });

  if (response.status !== 201) {
    throw new Error(`Failed to create task: ${response.content}`);
  }

  return response.json;
};

module.exports = {
  key: 'create_task',
  noun: 'Task',

  display: {
    label: 'Create Task',
    description: 'Creates a new task in AMG Portal.',
  },

  operation: {
    inputFields: [
      {
        key: 'title',
        label: 'Title',
        type: 'string',
        required: true,
        helpText: 'The title of the task.',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'text',
        required: false,
        helpText: 'A detailed description of the task.',
      },
      {
        key: 'program_id',
        label: 'Program ID',
        type: 'string',
        required: false,
        helpText: 'The ID of the program to create the task in. Either this or milestone_id is required.',
      },
      {
        key: 'milestone_id',
        label: 'Milestone ID',
        type: 'string',
        required: false,
        helpText: 'The ID of the milestone to create the task under.',
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'string',
        required: false,
        choices: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
      },
      {
        key: 'due_date',
        label: 'Due Date',
        type: 'datetime',
        required: false,
        helpText: 'When the task is due (YYYY-MM-DD format).',
      },
      {
        key: 'assigned_to_id',
        label: 'Assign To (User ID)',
        type: 'string',
        required: false,
        helpText: 'The ID of the user to assign this task to.',
      },
    ],

    perform: createTask,

    sample: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Review client documents',
      description: 'Review and approve uploaded documents',
      status: 'todo',
      priority: 'high',
      due_date: '2024-03-15',
      program_id: '123e4567-e89b-12d3-a456-426614174002',
      milestone_id: '123e4567-e89b-12d3-a456-426614174003',
      assigned_to_id: '123e4567-e89b-12d3-a456-426614174004',
      created_at: '2024-03-01T10:00:00Z',
    },

    outputFields: [
      { key: 'id', label: 'Task ID', type: 'string' },
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'priority', label: 'Priority', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'datetime' },
    ],
  },
};
