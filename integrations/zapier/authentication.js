/**
 * Authentication for AMG Portal Zapier Integration
 *
 * Uses API Key authentication (Custom Auth).
 * Users create an API key in AMG Portal and enter it when connecting.
 */

const test = (z, bundle) => {
  // Test the API key by calling the test endpoint
  return z.request({
    url: `${bundle.authData.apiUrl}/api/v1/public/test`,
    method: 'POST',
    headers: {
      'X-API-Key': bundle.authData.apiKey,
    },
  }).then((response) => {
    if (response.status !== 200) {
      throw new Error('Invalid API key');
    }
    return response.json;
  });
};

module.exports = {
  type: 'custom',

  // Fields shown when connecting the account
  fields: [
    {
      key: 'apiUrl',
      label: 'API URL',
      type: 'string',
      required: true,
      default: 'https://api.amg-portal.com',
      helpText: 'The base URL of your AMG Portal instance. Use `https://api.amg-portal.com` for the cloud version.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      helpText: 'Your AMG Portal API key. Create one in Settings > API Keys.',
    },
  ],

  // Test auth when connecting
  test: test,

  // Connection label shown in Zapier UI
  connectionLabel: '{{json.user.name}} ({{json.user.email}})',
};
