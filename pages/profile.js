import React, { useState, useRef, useEffect } from 'react';
import { Camera, Heart, Music, Coffee, MapPin, Save, Star, Users, Sparkles } from 'lucide-react';
import { useRouter } from 'next/router';

export default function Profile() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // AUTH GUARD
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ⭐ MILAN ID STATE
  const [milanId, setMilanId] = useState('');
  const [isEditingMilanId, setIsEditingMilanId] = useState(false);
  const [newMilanId, setNewMilanId] = useState('');
  const [milanIdStatus, setMilanIdStatus] = useState({ text: '', color: '' });
  const [milanIdUpdating, setMilanIdUpdating] = useState(false);

  const initialProfileState = {
    name: '',
    age: '',
    city: '',
    bio: '',
    currentVibe: null,
    photo: null,
    hobbies: [],
    music: { bollywood: 50, indie: 50, ghazal: 50 },
    beverage: 'chai',
    languages: [],
    festivals: [],
    dealBreakers: [],
    greenFlags: [],
    foodieLevel: 50,
    travelStyle: 'explorer'
  };

  const [activeTab, setActiveTab] = useState('basic');
  const [profileData, setProfileData] = useState(initialProfileState);

  // AUTH + local profile load
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    try {
      const savedProfile =
        localStorage.getItem('milanUser') || localStorage.getItem('milanProfile');

      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        const mergedProfile = Object.assign({}, initialProfileState, parsed);
        setProfileData(mergedProfile);

        if (parsed.milanId) {
          setMilanId(parsed.milanId);
        }
      } else {
        setProfileData(initialProfileState);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setProfileData(initialProfileState);
    }

    setIsAuthenticated(true);
  }, [router]);

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

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  async function uploadProfilePic(file) {
    const fd = new FormData();
    fd.append('image', file);

    const res = await fetch('https://milan-j9u9.onrender.com/api/upload/profile', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + (localStorage.getItem('token') || '')
      },
      body: fd
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error('Upload failed: ' + text);
    }
    return res.json();
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const data = await uploadProfilePic(file);
      if (data?.url) {
        const newProfile = { ...profileData, photo: data.url };
        setProfileData(newProfile);

        try {
          localStorage.setItem('milanProfile', JSON.stringify(newProfile));
        } catch (err) {
          console.warn('localStorage set failed', err);
        }

        window.dispatchEvent(new CustomEvent('milan:user-updated', { detail: newProfile }));
      } else {
        console.warn('Upload returned unexpected data:', data);
        alert('Upload succeeded but no URL returned. Check server logs.');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      alert('Photo upload failed. Open console for details.');
    } finally {
      setUploading(false);
    }
  };

  const handleVibeSelect = (vibe) => {
    setProfileData({ ...profileData, currentVibe: vibe });
  };

  const toggleItem = (field, item) => {
    const current = profileData[field] || [];
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    setProfileData({ ...profileData, [field]: updated });
  };

  const handleSliderChange = (category, value) => {
    setProfileData({
      ...profileData,
      music: { ...profileData.music, [category]: Number(value) }
    });
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('https://milan-j9u9.onrender.com/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: JSON.stringify(profileData)
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Save failed:', text);
        alert('Profile save failed: ' + (text || res.status));
        return;
      }

      const json = await res.json();
      if (json.user) {
        localStorage.setItem('milanUser', JSON.stringify(json.user));
        window.dispatchEvent(new CustomEvent('milan:user-updated', { detail: json.user }));

        if (json.user.milanId) {
          setMilanId(json.user.milanId);
        }
      } else {
        localStorage.setItem('milanProfile', JSON.stringify(profileData));
        window.dispatchEvent(new CustomEvent('milan:user-updated', { detail: profileData }));
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    router.push('/connect');
  };

  // ⭐ Milan ID edit handlers
  const handleStartEditMilanId = () => {
    setIsEditingMilanId(true);
    setNewMilanId(milanId || '');
    setMilanIdStatus({
      text: 'Use 3–20 characters: a-z, 0-9, underscore (_)',
      color: 'text-gray-500'
    });
  };

  const handleCancelMilanIdEdit = () => {
    setIsEditingMilanId(false);
    setNewMilanId('');
    setMilanIdStatus({ text: '', color: '' });
  };

  const handleSaveMilanId = async () => {
    const trimmed = (newMilanId || '').trim();

    if (!trimmed) {
      setMilanIdStatus({ text: 'Milan ID cannot be empty.', color: 'text-red-500' });
      return;
    }

    const regex = /^[a-z0-9_]{3,20}$/;
    if (!regex.test(trimmed)) {
      setMilanIdStatus({
        text: 'Use 3–20 characters: a-z, 0-9, underscore (_).',
        color: 'text-red-500'
      });
      return;
    }

    const token =
      (typeof window !== 'undefined' && localStorage.getItem('token')) || '';
    if (!token) {
      setMilanIdStatus({
        text: 'Session expired. Please login again.',
        color: 'text-red-500'
      });
      return;
    }

    try {
      setMilanIdUpdating(true);
      setMilanIdStatus({
        text: 'Updating your Milan ID...',
        color: 'text-gray-500'
      });

      const res = await fetch(
        'https://milan-j9u9.onrender.com/api/user/milan-id',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ milanId: trimmed })
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          'Failed to update Milan ID.';
        setMilanIdStatus({ text: msg, color: 'text-red-500' });
        return;
      }

      setMilanId(data.milanId);
      setMilanIdStatus({
        text: 'Milan ID updated successfully 💖',
        color: 'text-green-600'
      });
      setIsEditingMilanId(false);
      setNewMilanId('');

      try {
        const rawUser = localStorage.getItem('milanUser');
        if (rawUser) {
          const userObj = JSON.parse(rawUser);
          const updatedUser = { ...userObj, milanId: data.milanId };
          localStorage.setItem('milanUser', JSON.stringify(updatedUser));
          window.dispatchEvent(
            new CustomEvent('milan:user-updated', { detail: updatedUser })
          );
        }
      } catch (err) {
        console.warn(
          'Failed to update milanUser in localStorage after Milan ID change:',
          err
        );
      }
    } catch (err) {
      console.error('Error updating Milan ID:', err);
      setMilanIdStatus({
        text: 'Server error. Please try again.',
        color: 'text-red-500'
      });
    } finally {
      setMilanIdUpdating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-2xl text-pink-600 font-bold flex items-center gap-2 animate-pulse">
          <Heart className="fill-pink-600 w-8 h-8" /> Loading Profile...
        </div>
      </div>
    );
  }

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
        {/* Profile Photo */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-2 border-pink-100">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div
                onClick={handlePhotoClick}
                className={`w-32 h-32 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition overflow-hidden ${
                  uploading ? 'opacity-60' : ''
                }`}
              >
                {profileData.photo ? (
                  <img
                    src={profileData.photo}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera size={40} className="text-pink-600" />
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-25 text-white text-sm">
                    Uploading...
                  </div>
                )}
              </div>
              <button
                onClick={handlePhotoClick}
                className="absolute bottom-0 right-0 bg-pink-500 text-white p-2 rounded-full hover:bg-pink-600 transition"
                disabled={uploading}
              >
                <Camera size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
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

        {/* BASIC TAB */}
        {activeTab === 'basic' && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Basic Information
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) =>
                  setProfileData({ ...profileData, name: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none text-gray-900 bg-white placeholder-gray-400"
                placeholder="Apna naam likho"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age
                </label>
                <input
                  type="number"
                  value={profileData.age}
                  onChange={(e) =>
                    setProfileData({ ...profileData, age: e.target.value })
                  }
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none text-gray-900 bg-white placeholder-gray-400"
                  placeholder="Umra"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={profileData.city}
                  onChange={(e) =>
                    setProfileData({ ...profileData, city: e.target.value })
                  }
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none text-gray-900 bg-white placeholder-gray-400"
                  placeholder="Sheher"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                value={profileData.bio}
                onChange={(e) =>
                  setProfileData({ ...profileData, bio: e.target.value })
                }
                className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none h-24 text-gray-900 bg-white placeholder-gray-400"
                placeholder="Apne baare mein kuch batao..."
              />
            </div>

            {/* ⭐ MILAN ID BLOCK */}
            <div className="mt-6 p-4 rounded-xl border-2 border-purple-100 bg-purple-50/60">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-purple-700">
                    Your Milan ID
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    @{milanId || 'not-set-yet'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Ye ID future me Add Friend / search ke liye use hogi.
                  </p>
                </div>

                {!isEditingMilanId && (
                  <button
                    type="button"
                    onClick={handleStartEditMilanId}
                    className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow hover:shadow-md transition"
                  >
                    {milanId ? 'Change Milan ID' : 'Set Milan ID'}
                  </button>
                )}
              </div>

              {isEditingMilanId && (
                <div className="mt-3 space-y-3">
                  {/* Input full width */}
                  <input
                    type="text"
                    value={newMilanId}
                    onChange={(e) => setNewMilanId(e.target.value)}
                    placeholder="enter new Milan ID (a-z, 0-9, _)"
                    className="w-full px-4 py-2 border-2 border-pink-200 rounded-full focus:border-pink-500 focus:outline-none text-gray-900 bg-white placeholder-gray-400 text-sm"
                  />

                  {/* Buttons */}
                  <div className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={handleSaveMilanId}
                      disabled={milanIdUpdating}
                      className="flex-1 px-4 py-2 rounded-full text-sm font-semibold bg-pink-500 text-white shadow hover:bg-pink-600 disabled:opacity-60 disabled:cursor-not-allowed text-center"
                    >
                      {milanIdUpdating ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelMilanIdEdit}
                      className="px-3 py-2 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {milanIdStatus.text && (
                <p className={`mt-2 text-xs ${milanIdStatus.color}`}>
                  {milanIdStatus.text}
                </p>
              )}
            </div>
          </div>
        )}

        {/* VIBE TAB */}
        {activeTab === 'vibe' && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              The Vibe Check 🌟
            </h2>
            <p className="text-gray-600 mb-6">
              Aaj ka mood kaisa hai? Select karo!
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {vibes.map((vibe) => (
                <button
                  key={vibe.label}
                  onClick={() => handleVibeSelect(vibe)}
                  className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                    profileData.currentVibe?.label === vibe.label
                      ? `${vibe.color} border-current shadow-lg scale-105 ring-2 ring-offset-2 ring-pink-400`
                      : 'bg-white border-gray-200 hover:border-pink-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{vibe.emoji}</div>
                  <div className="text-xs font-medium text-center">
                    {vibe.label}
                  </div>
                </button>
              ))}
            </div>

            {profileData.currentVibe && (
              <div className="mt-6 p-4 bg-gradient-to-r from-pink-100 to-purple-100 rounded-xl">
                <p className="text-center text-gray-800">
                  <span className="text-2xl mr-2">
                    {profileData.currentVibe.emoji}
                  </span>
                  <span className="font-medium">
                    Current Vibe: {profileData.currentVibe.label}
                  </span>
                </p>
              </div>
            )}

            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Music className="text-pink-500" /> Music Taste Meter
              </h3>
              {[
                { key: 'bollywood', label: '🎬 Bollywood' },
                { key: 'indie', label: '🎸 Indie/Pop' },
                { key: 'ghazal', label: '🎵 Ghazal/Classical' }
              ].map((genre) => (
                <div key={genre.key} className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-gray-800">
                      {genre.label}
                    </span>
                    <span className="text-pink-500">
                      {profileData.music[genre.key]}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={profileData.music[genre.key]}
                    onChange={(e) =>
                      handleSliderChange(genre.key, e.target.value)
                    }
                    className="w-full h-2 bg-pink-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Coffee className="text-pink-500" /> Chai ya Coffee?
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['chai', 'coffee', 'both', 'neither'].map((option) => (
                  <button
                    key={option}
                    onClick={() =>
                      setProfileData({ ...profileData, beverage: option })
                    }
                    className={`p-3 rounded-lg border-2 transition ${
                      profileData.beverage === option
                        ? 'bg-pink-500 text-white border-pink-500'
                        : 'bg-white border-gray-200 hover:border-pink-300 text-gray-800'
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

        {/* PERSONALITY TAB */}
        {activeTab === 'personality' && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex itemscenter gap-2">
                <Star className="text-pink-500" /> Hobbies & Interests
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {hobbyOptions.map((hobby) => (
                  <button
                    key={hobby}
                    onClick={() => toggleItem('hobbies', hobby)}
                    className={`px-3 py-2 rounded-full border-2 transition text-sm ${
                      profileData.hobbies.includes(hobby)
                        ? 'bg-pink-500 text-white border-pink-500'
                        : 'bg-white border-gray-200 hover:border-pink-300 text-gray-800'
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleItem('languages', lang)}
                    className={`px-3 py-2 rounded-full border-2 transition text-sm ${
                      profileData.languages.includes(lang)
                        ? 'bg-purple-500 text-white border-purple-500'
                        : 'bg-white border-gray-200 hover:border-purple-300 text-gray-800'
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {festivals.map((fest) => (
                  <button
                    key={fest}
                    onClick={() => toggleItem('festivals', fest)}
                    className={`px-3 py-2 rounded-full border-2 transition text-sm ${
                      profileData.festivals.includes(fest)
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white border-gray-200 hover:border-orange-300 text-gray-800'
                    }`}
                  >
                    {fest}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                🍕 Foodie Level
              </h3>
              <input
                type="range"
                min="0"
                max="100"
                value={profileData.foodieLevel}
                onChange={(e) =>
                  setProfileData({
                    ...profileData,
                    foodieLevel: e.target.value
                  })
                }
                className="w-full h-2 bg-pink-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
              <div className="flex justify-between mt-2 text-sm text-gray-800">
                <span>Khana = Fuel</span>
                <span className="font-bold text-pink-500">
                  {profileData.foodieLevel}%
                </span>
                <span>Food is Life! 🍕</span>
              </div>
            </div>
          </div>
        )}

        {/* PREFERENCES TAB */}
        {activeTab === 'preferences' && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                🚩 Deal Breakers
              </h2>
              <p className="text-gray-600 mb-4">
                Ye cheezein bilkul nahi chalegi
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {commonDealBreakers.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleItem('dealBreakers', item)}
                    className={`px-3 py-2 rounded-full border-2 transition text-sm ${
                      profileData.dealBreakers.includes(item)
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white border-gray-200 hover:border-red-300 text-gray-800'
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {commonGreenFlags.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleItem('greenFlags', item)}
                    className={`px-3 py-2 rounded-full border-2 transition text-sm ${
                      profileData.greenFlags.includes(item)
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white border-gray-200 hover:border-green-300 text-gray-800'
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['explorer', 'planner', 'spontaneous', 'homebody'].map(
                  (style) => (
                    <button
                      key={style}
                      onClick={() =>
                        setProfileData({ ...profileData, travelStyle: style })
                      }
                      className={`p-3 rounded-lg border-2 transition capitalize ${
                        profileData.travelStyle === style
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white border-gray-200 hover:border-blue-300 text-gray-800'
                      }`}
                    >
                      {style}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save Profile Button */}
        <button
          onClick={handleSaveProfile}
          className="w-full mt-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2"
        >
          <Save size={24} />
          Save Profile
        </button>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="success-modal-overlay">
          <div className="success-modal">
            <div className="modal-content">
              <div className="sparkle-icon">✨</div>
              <div className="heart-icon-small">💖</div>
              <h2 className="modal-title-success">Profile Saved Successfully!</h2>

              <p className="modal-message-success">
                Your story is ready! You can now connect with beautiful hearts
                on Milan. ✨
              </p>

              <button
                onClick={handleSuccessModalClose}
                className="modal-btn-action"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .success-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(8, 6, 12, 0.9);
          backdrop-filter: blur(12px);
          animation: fadeIn 0.3s ease;
          padding: 20px;
        }

        .success-modal {
          width: min(480px, 100%);
          background: linear-gradient(
            145deg,
            rgba(255, 110, 167, 0.2) 0%,
            rgba(139, 92, 246, 0.15) 100%
          );
          border: 3px solid rgba(255, 110, 167, 0.5);
          border-radius: 28px;
          padding: 40px 30px;
          text-align: center;
          box-shadow: 0 40px 100px rgba(255, 110, 167, 0.4),
            0 0 80px rgba(139, 92, 246, 0.25),
            inset 0 2px 2px rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
          animation: modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .success-modal::before {
          content: '';
          position: absolute;
          inset: -5px;
          border-radius: inherit;
          background: radial-gradient(
            circle at top left,
            rgba(255, 110, 167, 0.2),
            transparent 70%
          );
          animation: pulseGlow 4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes modalPop {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulseGlow {
          0%,
          100% {
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
        }

        .sparkle-icon {
          font-size: 4rem;
          margin-bottom: 5px;
          animation: sparklePulse 1.5s ease-in-out infinite;
          filter: drop-shadow(0 4px 16px rgba(255, 255, 255, 0.5));
        }

        @keyframes sparklePulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        .heart-icon-small {
          font-size: 2.5rem;
          margin-bottom: 15px;
          color: #ff6ea7;
          animation: heartBeatSuccess 1s ease-in-out infinite;
        }

        @keyframes heartBeatSuccess {
          0%,
          100% {
            transform: scale(1);
          }
          25% {
            transform: scale(1.2);
          }
          50% {
            transform: scale(1.1);
          }
        }

        .modal-title-success {
          font-size: 26px;
          font-weight: 900;
          margin: 0 0 10px 0;
          background: linear-gradient(90deg, #ffc4e1, #ffffff, #ff6ea7);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 3px 15px rgba(255, 110, 167, 0.5);
        }

        .modal-message-success {
          font-size: 16px;
          line-height: 1.6;
          color: #ffdfe8;
          margin-bottom: 30px;
          font-weight: 500;
        }

        .modal-btn-action {
          padding: 15px 40px;
          background: linear-gradient(135deg, #4cd964, #34c759);
          color: #ffffff;
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(76, 217, 100, 0.4);
          transition: all 0.3s ease;
          text-transform: uppercase;
        }

        .modal-btn-action:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(76, 217, 100, 0.5);
        }

        @media (max-width: 480px) {
          .success-modal {
            padding: 30px 20px;
          }
          .sparkle-icon {
            font-size: 3rem;
          }
          .heart-icon-small {
            font-size: 2rem;
          }
          .modal-title-success {
            font-size: 22px;
          }
          .modal-message-success {
            font-size: 14px;
          }
          .modal-btn-action {
            padding: 12px 30px;
            font-size: 15px;
          }
        }
      `}</style>
    </div>
  );
}
