'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Navigation } from '@/components/Navigation'
import { Heart, MapPin, Hotel, Gift, Star, Camera, Search, Filter, Plus } from 'lucide-react'

export default function ExchangesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  const categories = [
    { id: 'ALL', label: 'Tout', icon: Star },
    { id: 'HOTELS', label: 'Hôtels', icon: Hotel },
    { id: 'RESTAURANTS', label: 'Restaurants', icon: MapPin },
    { id: 'ACTIVITIES', label: 'Activités', icon: Camera },
    { id: 'OBJECTS', label: 'Objets', icon: Gift },
  ]

  const exchanges = [
    {
      id: 1,
      title: 'Hôtel Le Romantic - Paris',
      description: 'Magnifique hôtel avec spa et vue sur la Seine. Parfait pour un week-end romantique.',
      category: 'HOTELS',
      type: 'OFFER',
      location: 'Paris, France',
      rating: 4.8,
      reviews: 12,
      user: 'Marie & Pierre',
      image: '/placeholder-hotel.jpg'
    },
    {
      id: 2,
      title: 'Table au restaurant Le Gourmet',
      description: 'Réservation pour 2 personnes dans un restaurant étoilé. Date flexible.',
      category: 'RESTAURANTS',
      type: 'OFFER',
      location: 'Lyon, France',
      rating: 4.5,
      reviews: 8,
      user: 'Sophie & Thomas',
      image: '/placeholder-restaurant.jpg'
    },
    {
      id: 3,
      title: 'Appareil photo vintage',
      description: 'Polaroid vintage en excellent état. Parfait pour des photos souvenirs romantiques.',
      category: 'OBJECTS',
      type: 'REQUEST',
      location: 'Marseille, France',
      rating: 4.2,
      reviews: 5,
      user: 'Emma & Lucas',
      image: '/placeholder-camera.jpg'
    }
  ]

  const filteredExchanges = exchanges.filter(exchange => {
    const matchesSearch = exchange.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exchange.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'ALL' || exchange.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Échanges</h2>
          <p className="text-gray-600 mb-6">
            Découvrez et partagez des expériences, des lieux et des objets avec d'autres couples
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                placeholder="Rechercher des échanges..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="sm:w-auto">
              <Filter className="mr-2" size={16} />
              Filtres
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center"
                >
                  <Icon className="mr-2" size={16} />
                  {category.label}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExchanges.map((exchange) => (
            <Card key={exchange.id} className="hover:shadow-lg transition-shadow overflow-hidden">
              <div className="h-48 bg-gradient-to-r from-pink-200 to-purple-200 flex items-center justify-center">
                <Camera className="text-gray-400" size={48} />
              </div>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg line-clamp-2">{exchange.title}</CardTitle>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    exchange.type === 'OFFER'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {exchange.type === 'OFFER' ? 'Offre' : 'Recherche'}
                  </span>
                </div>
                <CardDescription className="line-clamp-2">
                  {exchange.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="mr-1" size={14} />
                    {exchange.location}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(exchange.rating)
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="ml-1 text-sm text-gray-600">
                        {exchange.rating} ({exchange.reviews})
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">{exchange.user}</span>
                  </div>
                  <Button className="w-full" variant="outline">
                    Voir les détails
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredExchanges.length === 0 && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="mb-4">
                <Search className="mx-auto text-gray-400" size={48} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun échange trouvé
              </h3>
              <p className="text-gray-600 mb-4">
                Essayez de modifier vos critères de recherche ou créez un nouvel échange.
              </p>
              <Button>
                <Plus className="mr-2" size={16} />
                Créer un échange
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}