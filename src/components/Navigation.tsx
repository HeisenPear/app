'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Heart, Home, Users, MessageSquare, User, LogOut } from 'lucide-react'

export function Navigation() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const navItems = [
    { href: '/', label: 'Accueil', icon: Home },
    { href: '/exchanges', label: 'Échanges', icon: Users },
    { href: '/feed', label: 'Feed', icon: MessageSquare },
    { href: '/profile', label: 'Profil', icon: User },
  ]

  if (!session) {
    return null
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center">
            <h1 className="text-2xl font-bold text-purple-800">
              <Heart className="inline-block mr-2 text-pink-500" />
              CoupleExchange
            </h1>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-purple-700 bg-purple-100'
                      : 'text-gray-600 hover:text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <Icon className="mr-2" size={16} />
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="flex items-center space-x-4">
            <span className="hidden sm:block text-sm text-gray-600">
              Bonjour, {session.user?.name?.split(' ')[0] || 'Utilisateur'}
            </span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="mr-2" size={16} />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t">
          <div className="flex justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center px-3 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-purple-700'
                      : 'text-gray-600 hover:text-purple-700'
                  }`}
                >
                  <Icon size={20} className="mb-1" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}