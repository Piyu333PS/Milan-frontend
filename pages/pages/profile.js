import React, { useState } from 'react';
import { Camera, Heart, Music, Coffee, MapPin, Mic, Users, Sparkles, Star, ChevronDown, Save, Moon, Sun, Cloud, Zap } from 'lucide-react';

export default function Profile() {
  const [activeTab, setActiveTab] = useState('basic');
  const [profileData, setProfileData] = useState({
    name: '',
    age: '',
    city: '',
    bio: '',
    currentVibe: null,
    photos: [],
    hobbies: [],
    music: { bollywood: 50, indie: 50, ghazal: 50 },
    beverage: 'chai',
    languages: [],
    festivals: [],
    dealBreakers: [],
    greenFlags: [],
    foodieLevel: 50,
    travelStyle: 'explorer'
  });

  const vibes = [
    { emoji: '☕', label: 'Chai pe charcha', color: 'bg-amber-100 text-amber-700' },
    { emoji: '🎬', label: 'Filmy mood', color: 'bg-purple-100 text-purple-700' },
    { emoji: '😤', label: 'Need a listener', color: 'bg-blue-100 text-blue-700' },
    { emoji: '🤔', label: 'Deep talks only', color: 'bg-indigo-100 text-indigo-700' },
    { emoji: '💃', label: 'Sirf Masti', color: 'bg-pink-100 text-pink-700' },
    { emoji: '🌙', label: 'Night owl vibes', color: 'bg-slate-100 text-slate-700' },
    { emoji: '🎵', label: 'Music mood', color: 'bg-green-100 text-green-700' },
    { emoji: '📚', label: 'Bookworm mode', color: 'bg-orange-100 text-orange-700' }
  ];

  const languages = ['Hindi', 'English', 'Punjabi', 'Bengali', 'Marathi', 'Tamil', 'Telugu', 'Gujarati'];
  const festivals = ['Diwali', 'Holi', 'Eid', 'Christmas', 'Navratri', 'Durga Puja', 'Onam', 'Pongal'];

  const hobbyOptions = [
    'Travel', 'Photography', 'Cooking', 'Gaming', 'Dancing', 'Singing', 
    'Reading', 'Gym', 'Yoga', 'Painting', 'Writing', 'Gardening'
  ];

  const commonDealBreakers = [
    'Smoking', 'Party every weekend', 'No family time', 'Poor hygiene', 
    'Rude to waiters', 'Always on phone', 'No sense of humor'
  ];

  const commonGreenFlags = [
    'Good listener', 'Respects parents', 'Has goals', 'Makes me laugh',
    'Good cook', 'Pet lover', 'Financially stable', 'Emotionally mature'
  ];

  const handleVibeSelect = (vibe) => {
    setProfileData({ ...profileData, currentVibe: vibe });
  };

  const toggleItem = (field, item) => {
    const current = profileData[field];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    setProfileData({ ...profileData, [field]: updated });
  };

  const handleSliderChange = (category, value) => {
    setProfileData({
      ...profileData,
      music: { ...profileData.music, [category]: value }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Heart className="fill-white" /> Milan Love Profile
          </h1>
          <p className="text-pink-100 mt-1">Apni kahaani, apne andaaz mein ✨</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Profile Photo Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-2 border-pink-100">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-32 h-32 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center">
                <Camera size={40} className="text-pink-600" />
              </div>
              <button className="absolute bottom-0 right-0 bg-pink-500 text-white p-2 rounded-full hover:bg-pink-600 transition">
                <Camera size={16} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-3">Click to upload photo</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
          {['basic', 'vibe', 'personality', 'preferences'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-full font-medium whitespace-nowrap transition ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab === 'basic' && '📝 Basic Info'}
              {tab === 'vibe' && '✨ Vibe Check'}
              {tab === 'personality' && '🎭 Personality'}
              {tab === 'preferences' && '💫 Preferences'}
            </button>
          ))}
        </div>

        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none"
                placeholder="Apna naam likho"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                <input
                  type="number"
                  value={profileData.age}
                  onChange={(e) => setProfileData({...profileData, age: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Umra"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={profileData.city}
                  onChange={(e) => setProfileData({...profileData, city: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none"
                  placeholder="Sheher"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
              <textarea
                value={profileData.bio}
                onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none h-24"
                placeholder="Apne baare mein kuch batao..."
              />
            </div>
          </div>
        )}

        {/* Vibe Check Tab */}
        {activeTab === 'vibe' && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">The Vibe Check 🌟</h2>
            <p className="text-gray-600 mb-6">Aaj ka mood kaisa hai? Select karo!</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {vibes.map((vibe) => (
                <button
                  key={vibe.label}
                  onClick={() => handleVibeSelect(vibe)}
                  className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                    profileData.currentVibe?.label === vibe.label
                      ? `${vibe.color} border-current shadow-lg scale-105`
                      : 'bg-white border-gray-200 hover:border-pink-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{vibe.emoji}</div>
                  <div className="text-xs font-medium text-center">{vibe.label}</div>
                </button>
              ))}
            </div>

            {profileData.currentVibe && (
              <div className="mt-6 p-4 bg-gradient-to-r from-pink-100 to-purple-100 rounded-xl">
                <p className="text-center">
                  <span className="text-2xl mr-2">{profileData.currentVibe.emoji}</span>
                  <span className="font-medium">Current Vibe: {profileData.currentVibe.label}</span>
                </p>
              </div>
            )}

            {/* Music Taste Slider */}
            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Music className="text-pink-500" /> Music Taste Meter
              </h3>
              
              {Object.keys(profileData.music).map((genre) => (
                <div key={genre} className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="capitalize font-medium">{genre}</span>
                    <span className="text-pink-500">{profileData.music[genre]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={profileData.music[genre]}
                    onChange={(e) => handleSliderChange(genre, e.target.value)}
                    className="w-full h-2 bg-pink-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${profileData.music[genre]}%, #fce7f3 ${profileData.music[genre]}%, #fce7f3 100%)`
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Chai vs Coffee */}
            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Coffee className="text-pink-500" /> Chai ya Coffee?
              </h3>
              <div className="flex gap-4">
                {['chai', 'coffee', 'both', 'neither'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setProfileData({...profileData, beverage: option})}
                    className={`flex-1 p-3 rounded-lg border-2 transition ${
                      profileData.beverage === option
                        ? 'bg-pink-500 text-white border-pink-500'
                        : 'bg-white border-gray-200 hover:border-pink-300'
                    }`}
                  >
                    {option === 'chai' && '☕ Chai'}
                    {option === 'coffee' && '☕ Coffee'}
                    {option === 'both' && '☕ Dono'}
                    {option === 'neither' && '❌ Koi nahi'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Personality Tab */}
        {activeTab === 'personality' && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Star className="text-pink-500" /> Hobbies & Interests
              </h2>
              <div className="flex flex-wrap gap-2">
                {hobbyOptions.map((hobby) => (
                  <button
                    key={hobby}
                    onClick={() => toggleItem('hobbies', hobby)}
                    className={`px-4 py-2 rounded-full border-2 transition ${
                      profileData.hobbies.includes(hobby)
                        ? 'bg-pink-500 text-white border-pink-500'
                        : 'bg-white border-gray-200 hover:border-pink-300'
                    }`}
                  >
                    {hobby}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="text-pink-500" /> Languages
              </h3>
              <div className="flex flex-wrap gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleItem('languages', lang)}
                    className={`px-4 py-2 rounded-full border-2 transition ${
                      profileData.languages.includes(lang)
                        ? 'bg-purple-500 text-white border-purple-500'
                        : 'bg-white border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Sparkles className="text-pink-500" /> Festivals I Love
              </h3>
              <div className="flex flex-wrap gap-2">
                {festivals.map((fest) => (
                  <button
                    key={fest}
                    onClick={() => toggleItem('festivals', fest)}
                    className={`px-4 py-2 rounded-full border-2 transition ${
                      profileData.festivals.includes(fest)
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    {fest}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">🍕 Foodie Level</h3>
              <input
                type="range"
                min="0"
                max="100"
                value={profileData.foodieLevel}
                onChange={(e) => setProfileData({...profileData, foodieLevel: e.target.value})}
                className="w-full h-2 bg-pink-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between mt-2 text-sm">
                <span>Khana = Fuel</span>
                <span className="font-bold text-pink-500">{profileData.foodieLevel}%</span>
                <span>Food is Life! 🍕</span>
              </div>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                🚩 Deal Breakers
              </h2>
              <p className="text-gray-600 mb-4">Ye cheezein bilkul nahi chalegi</p>
              <div className="flex flex-wrap gap-2">
                {commonDealBreakers.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleItem('dealBreakers', item)}
                    className={`px-4 py-2 rounded-full border-2 transition ${
                      profileData.dealBreakers.includes(item)
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white border-gray-200 hover:border-red-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                ✅ Green Flags
              </h2>
              <p className="text-gray-600 mb-4">Ye qualities zaroori hain</p>
              <div className="flex flex-wrap gap-2">
                {commonGreenFlags.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleItem('greenFlags', item)}
                    className={`px-4 py-2 rounded-full border-2 transition ${
                      profileData.greenFlags.includes(item)
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white border-gray-200 hover:border-green-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="text-pink-500" /> Travel Style
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {['explorer', 'planner', 'spontaneous', 'homebody'].map((style) => (
                  <button
                    key={style}
                    onClick={() => setProfileData({...profileData, travelStyle: style})}
                    className={`p-3 rounded-lg border-2 transition capitalize ${
                      profileData.travelStyle === style
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <button className="w-full mt-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2">
          <Save size={24} />
          Save Profile
        </button>
      </div>
    </div>
  );
}
