import React, { useState } from 'react';
import { Camera, Calendar, Tag, Search, Filter, Upload, Image, Plus } from 'lucide-react';
import { FloatingActionButton } from './ui/FloatingActionButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import UploadPhotosView from './UploadPhotosView';

// Mock photo data - replace with real data from your database
const mockPhotos = [
  {
    id: 1,
    url: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800',
    caption: 'Team at the starting line',
    race: '2023 Relay Race',
    year: 2023,
    category: 'team'
  },
  {
    id: 2,
    url: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800',
    caption: 'Runner crossing finish line',
    race: '2023 Relay Race',
    year: 2023,
    category: 'action'
  },
  {
    id: 3,
    url: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800',
    caption: 'Victory celebration',
    race: '2022 Relay Race',
    year: 2022,
    category: 'celebration'
  },
  {
    id: 4,
    url: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800',
    caption: 'Pre-race preparation',
    race: '2022 Relay Race',
    year: 2022,
    category: 'preparation'
  },
  {
    id: 5,
    url: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800',
    caption: 'Team huddle before race',
    race: '2021 Relay Race',
    year: 2021,
    category: 'team'
  },
  {
    id: 6,
    url: 'https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800',
    caption: 'Mid-race action shot',
    race: '2021 Relay Race',
    year: 2021,
    category: 'action'
  }
];

const PhotosView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const categories = ['all', 'action', 'team', 'celebration', 'preparation'];
  const years = ['all', ...Array.from(new Set(mockPhotos.map(photo => photo.year.toString()))).sort().reverse()];

  const filteredPhotos = mockPhotos.filter(photo => {
    const matchesCategory = selectedCategory === 'all' || photo.category === selectedCategory;
    const matchesYear = selectedYear === 'all' || photo.year.toString() === selectedYear;
    const matchesSearch = searchTerm === '' || 
      photo.caption.toLowerCase().includes(searchTerm.toLowerCase()) ||
      photo.race.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesYear && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Race Photos</h1>
        <p className="text-lg text-gray-600">Capturing memories from our relay race adventures</p>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search photos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-2">
            <Tag className="w-5 h-5 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            >
              {years.map(year => (
                <option key={year} value={year}>
                  {year === 'all' ? 'All Years' : year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 text-center">
          <Camera className="w-8 h-8 text-primary-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{filteredPhotos.length}</h3>
          <p className="text-gray-600">Photos Found</p>
        </div>
        <div className="card p-6 text-center">
          <Calendar className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{new Set(filteredPhotos.map(p => p.year)).size}</h3>
          <p className="text-gray-600">Years Covered</p>
        </div>
        <div className="card p-6 text-center">
          <Tag className="w-8 h-8 text-purple-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{new Set(filteredPhotos.map(p => p.category)).size}</h3>
          <p className="text-gray-600">Categories</p>
        </div>
        <div className="card p-6 text-center">
          <Filter className="w-8 h-8 text-orange-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{new Set(filteredPhotos.map(p => p.race)).size}</h3>
          <p className="text-gray-600">Races</p>
        </div>
      </div>

      {/* Photo Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-12">
          <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No photos found</h3>
          <p className="text-gray-600">Try adjusting your filters or search terms</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPhotos.map((photo) => (
            <div key={photo.id} className="card overflow-hidden hover:shadow-lg transition-all duration-200 group">
              <div className="aspect-w-16 aspect-h-12 relative overflow-hidden">
                <img
                  src={photo.url}
                  alt={photo.caption}
                  className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute top-4 right-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    photo.category === 'action' ? 'bg-red-100 text-red-800' :
                    photo.category === 'team' ? 'bg-blue-100 text-blue-800' :
                    photo.category === 'celebration' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {photo.category}
                  </span>
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{photo.caption}</h3>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{photo.race}</span>
                  <span>{photo.year}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      <FloatingActionButton
        icon={Plus}
        label="Upload photos"
        onClick={() => setShowUploadDialog(true)}
      />

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Photos</DialogTitle>
          </DialogHeader>
          <UploadPhotosView />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotosView;