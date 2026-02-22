import * as React from 'react';

interface ConsentProps {
  uid: string;
  client?: {
    clientId: string;
    name?: string | null;
    logoUri?: string | null;
    brandColor?: string | null;
  };
  params: {
    scope?: string;
  };
  flash?: string;
}

const scopeDescriptions: Record<string, string> = {
  'openid': 'Sign you in using your Janus IdP account',
  'profile': 'Access your profile information (name)',
  'email': 'Access your email address'
};

export const Consent: React.FC<ConsentProps> = ({
  uid,
  client,
  params,
  flash
}) => {
  const clientName = client?.name || client?.clientId || 'Unknown Application';
  const scopes = params.scope ? params.scope.split(' ') : [];
  const validScopes = scopes.filter(s => scopeDescriptions[s]);

  const handleAbort = () => {
    const form = document.createElement('form');
    form.method = 'POST';
    // O path deve ser /oidc/interaction/... para compartilhar cookies com o OIDC Provider
    form.action = `/oidc/interaction/${uid}/abort`;
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-1">Janus IdP</h1>
          <p className="text-blue-100">Identity Provider</p>
        </div>

        {/* Flash Message */}
        {flash && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{flash}</p>
          </div>
        )}

        {/* Client Info */}
        <div className="px-6 py-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authorization Request</h2>
            <p className="text-gray-600">
              <strong>Application:</strong> {clientName}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              This application is requesting access to your account.
            </p>
          </div>

          {/* Scopes Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Permissions Requested</h3>
            <p className="text-sm text-gray-600 mb-4">
              The application is requesting the following permissions:
            </p>

            <div className="space-y-3">
              {validScopes.length > 0 ? (
                validScopes.map((scope) => (
                  <div key={scope} className="flex items-start p-3 bg-gray-50 rounded-md">
                    <div className="flex-shrink-0 text-2xl mr-3">🔒</div>
                    <div>
                      <strong className="text-gray-900">{scope}</strong>
                      <p className="text-sm text-gray-600">{scopeDescriptions[scope]}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No specific permissions requested.</p>
              )}
            </div>
          </div>

          {/* Form Actions */}
          {/* O path deve ser /oidc/interaction/... para compartilhar cookies com o OIDC Provider */}
          <form method="post" action={`/oidc/interaction/${uid}/confirm`}>
            <input type="hidden" name="consent" value="true" />
            
            <div className="flex space-x-3">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-md font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Authorize
              </button>
              <button
                type="button"
                onClick={handleAbort}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-md font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By authorizing, you allow this application to access the information listed above.
              You can revoke this access at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
