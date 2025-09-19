'use client'

import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Navigation } from '@/components/Navigation'
import { Heart, MapPin, Hotel, Gift, Star, Camera } from 'lucide-react'

export default function Home() {
  const { data: session } = useSession()

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-purple-800">
              <Heart className="inline-block mr-2 text-pink-500" />
              CoupleExchange
            </CardTitle>
            <CardDescription>
              Partagez vos expériences de couple et découvrez celles des autres
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-pink-100 rounded-lg">
                <Hotel className="mx-auto mb-2 text-pink-600" size={24} />
                <span className="text-sm font-medium">Hôtels</span>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <MapPin className="mx-auto mb-2 text-purple-600" size={24} />
                <span className="text-sm font-medium">Lieux</span>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Gift className="mx-auto mb-2 text-blue-600" size={24} />
                <span className="text-sm font-medium">Objets</span>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Camera className="mx-auto mb-2 text-green-600" size={24} />
                <span className="text-sm font-medium">Photos</span>
              </div>
            </div>
            <Button onClick={() => signIn()} className="w-full">
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/exchanges">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <Hotel className="mx-auto mb-2 text-pink-600" size={32} />
                <CardTitle className="text-lg">Hôtels</CardTitle>
                <CardDescription>Partagez vos expériences d'hôtels</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Explorer
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/exchanges">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <MapPin className="mx-auto mb-2 text-purple-600" size={32} />
                <CardTitle className="text-lg">Lieux</CardTitle>
                <CardDescription>Découvrez de nouveaux endroits</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Explorer
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/exchanges">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <Gift className="mx-auto mb-2 text-blue-600" size={32} />
                <CardTitle className="text-lg">Objets</CardTitle>
                <CardDescription>Échangez des objets du quotidien</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Explorer
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/exchanges">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <Star className="mx-auto mb-2 text-green-600" size={32} />
                <CardTitle className="text-lg">Expériences</CardTitle>
                <CardDescription>Partagez vos activités favorites</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Explorer
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Dernières publications</CardTitle>
                <CardDescription>Découvrez ce que partagent les autres couples</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center">
                        <Heart size={16} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">Couple Anonyme</p>
                        <p className="text-sm text-gray-500">Il y a 2 heures</p>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-2">
                      Magnifique week-end à l'hôtel Le Romantic à Paris !
                      Parfait pour une escapade romantique 💕
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Heart size={16} className="mr-1" /> 12 likes
                      </span>
                      <span>3 commentaires</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start">
                  <Camera className="mr-2" size={16} />
                  Partager une photo
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Gift className="mr-2" size={16} />
                  Proposer un échange
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Star className="mr-2" size={16} />
                  Laisser un avis
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
