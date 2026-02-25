import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { isLoggedIn, clearAuth, getUser } from '../lib/auth';

interface Props {
  children: ReactNode;
}

interface User {
  email: string;
  name?: string;
  orgId: string;
}

export default function Layout({ children }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    setUser(getUser<User>());
  }, [router]);

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/projects', label: 'Projects', icon: '📁' },
    { href: '/logs', label: 'Logs', icon: '📋' },
    { href: '/api-keys', label: 'API Keys', icon: '🔑' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold text-brand-600">
              RegulateAI
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    router.pathname === link.href
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-1">{link.icon}</span> {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
