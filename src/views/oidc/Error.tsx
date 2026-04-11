import * as React from 'react';

interface ErrorProps {
  error: string;
  message: string;
}

export const Error: React.FC<ErrorProps> = ({ error, message }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Cabeçalho com ícone de erro */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-12 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white">{error}</h1>
          </div>

        {/* Mensagem de erro */}
        <div className="px-6 py-8 text-center">
          <p className="text-gray-600 text-lg mb-8">{message}</p>
          
          {/* Botão para voltar */}
          <a
            href="/"
            className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-md font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Ir para a página inicial
          </a>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Se o problema persistir, entre em contato com o suporte.
          </p>
        </div>
      </div>
    </div>
  );
};
