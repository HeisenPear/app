'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Navigation } from '@/components/Navigation'
import { Heart, MessageCircle, Share2, Camera, MapPin, Star, MoreHorizontal } from 'lucide-react'

export default function FeedPage() {
  const [newPost, setNewPost] = useState('')

  const posts = [
    {
      id: 1,
      user: {
        name: 'Marie & Pierre',
        avatar: '/placeholder-avatar.jpg',
        time: 'Il y a 2 heures'
      },
      content: 'Magnifique week-end à l\'hôtel Le Romantic à Paris ! L\'accueil était chaleureux et la vue depuis notre chambre était à couper le souffle. Le spa était parfait pour se détendre après une journée de visite. Je recommande vivement pour une escapade romantique ! 💕',
      images: ['/placeholder-hotel-1.jpg'],
      location: 'Hôtel Le Romantic, Paris',
      likes: 12,
      comments: 3,
      isLiked: false,
      tags: ['#hotel', '#paris', '#romantic', '#weekend']
    },
    {
      id: 2,
      user: {
        name: 'Sophie & Thomas',
        avatar: '/placeholder-avatar.jpg',
        time: 'Il y a 5 heures'
      },
      content: 'Soirée incroyable au restaurant Le Gourmet ! Le chef nous a préparé un menu dégustation exceptionnel. Chaque plat était une œuvre d\'art. L\'ambiance était parfaite pour notre anniversaire de rencontre ✨',
      images: ['/placeholder-restaurant-1.jpg', '/placeholder-food-1.jpg'],
      location: 'Restaurant Le Gourmet, Lyon',
      likes: 24,
      comments: 7,
      isLiked: true,
      tags: ['#restaurant', '#lyon', '#gastronomie', '#anniversaire']
    },
    {
      id: 3,
      user: {
        name: 'Emma & Lucas',
        avatar: '/placeholder-avatar.jpg',
        time: 'Il y a 1 jour'
      },
      content: 'Journée découverte au Musée d\'Orsay ! Nous avons passé des heures à admirer les œuvres impressionnistes. L\'audioguide était très instructif. Parfait pour les couples qui aiment l\'art et la culture 🎨',
      images: ['/placeholder-museum-1.jpg'],
      location: 'Musée d\'Orsay, Paris',
      likes: 18,
      comments: 5,
      isLiked: false,
      tags: ['#musee', '#art', '#culture', '#paris']
    }
  ]

  const handleLike = (postId: number) => {
    // Logic to handle like
    console.log('Liked post:', postId)
  }

  const handleComment = (postId: number) => {
    // Logic to handle comment
    console.log('Comment on post:', postId)
  }

  const handleShare = (postId: number) => {
    // Logic to handle share
    console.log('Share post:', postId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* New Post Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex space-x-4">
              <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
                <Heart size={20} className="text-purple-600" />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Partagez votre dernière expérience de couple..."
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="border-none shadow-none text-lg p-0 focus-visible:ring-0"
                />
                <div className="flex items-center justify-between mt-4">
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                      <Camera className="mr-2" size={16} />
                      Photo
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MapPin className="mr-2" size={16} />
                      Lieu
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Star className="mr-2" size={16} />
                      Avis
                    </Button>
                  </div>
                  <Button disabled={!newPost.trim()}>
                    Publier
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts */}
        <div className="space-y-6">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
                      <Heart size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{post.user.name}</p>
                      <p className="text-sm text-gray-500">{post.user.time}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal size={20} />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Post Content */}
                  <p className="text-gray-800 leading-relaxed">{post.content}</p>

                  {/* Location */}
                  {post.location && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="mr-1" size={14} />
                      {post.location}
                    </div>
                  )}

                  {/* Images */}
                  {post.images && post.images.length > 0 && (
                    <div className={`grid gap-2 ${
                      post.images.length === 1
                        ? 'grid-cols-1'
                        : post.images.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-2'
                    }`}>
                      {post.images.map((image, index) => (
                        <div
                          key={index}
                          className={`bg-gradient-to-r from-pink-200 to-purple-200 rounded-lg flex items-center justify-center ${
                            post.images.length === 1 ? 'h-64' : 'h-32'
                          }`}
                        >
                          <Camera className="text-gray-400" size={32} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {post.tags && (
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-sm text-purple-600 hover:text-purple-800 cursor-pointer"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(post.id)}
                        className={`${post.isLiked ? 'text-red-500' : 'text-gray-600'}`}
                      >
                        <Heart
                          className={`mr-2 ${post.isLiked ? 'fill-current' : ''}`}
                          size={18}
                        />
                        {post.likes}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleComment(post.id)}
                        className="text-gray-600"
                      >
                        <MessageCircle className="mr-2" size={18} />
                        {post.comments}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShare(post.id)}
                        className="text-gray-600"
                      >
                        <Share2 size={18} />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-8">
          <Button variant="outline">
            Charger plus de publications
          </Button>
        </div>
      </main>
    </div>
  )
}