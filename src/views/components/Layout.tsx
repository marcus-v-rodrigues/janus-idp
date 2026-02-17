import * as React from 'react';

export type LayoutVariant = 'auth' | 'admin';

interface LayoutProps {
  variant: LayoutVariant;
  children: React.ReactNode;
  title?: string;
  sidebarLinks?: Array<{ href: string; label: string; active?: boolean }>;
}

export const Layout: React.FC<LayoutProps> = ({
  variant,
  children,
  title = 'Janus IDP',
  sidebarLinks = [],
}) => {
  if (variant === 'auth') {
    // Layout de autenticação: centralizado, fundo limpo
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {children}
        </div>
      </div>
    );
  }

  if (variant === 'admin') {
    // Layout de admin: barra lateral fixa + área de conteúdo
    return (
      <div className="min-h-screen bg-gray-100 flex">
        {/* Barra lateral */}
        <aside className="w-64 bg-gray-900 text-white fixed h-full">
          <div className="p-6">
            <h1 className="text-xl font-bold">Admin Portal</h1>
          </div>
          <nav className="mt-6">
            <ul className="space-y-2 px-4">
              {sidebarLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={`block px-4 py-2 rounded-md transition-colors ${
                      link.active
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
            <a
              href="/admin/logout"
              className="block text-center text-sm text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </a>
          </div>
        </aside>

        {/* Área principal de conteúdo */}
        <main className="ml-64 flex-1 p-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          </header>
          {children}
        </main>
      </div>
    );
  }

  return null;
};
