import { useState, useEffect } from 'react';
import { User, Edit3, Footprints, MapPin, Flame, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface DashboardProps {
  onPlanifyWalk: () => void;
}

const Dashboard = ({ onPlanifyWalk }: DashboardProps) => {
  const { signOut, user } = useAuth();
  const [userProfile, setUserProfile] = useState({
    firstName: "Utilisateur",
    gender: "-",
    height: 0,
    weight: 0,
    age: 0,
    avatar: null
  });

  // Load user profile from Supabase
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error loading profile:', error);
          return;
        }

        if (profile) {
          setUserProfile({
            firstName: profile.first_name || "Utilisateur",
            gender: profile.gender || "-",
            height: profile.height_m || 0,
            weight: profile.weight_kg || 0,
            age: profile.age_years || 0,
            avatar: profile.avatar_url || null
          });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    loadUserProfile();
  }, [user]);

  const todayStats = {
    steps: 8247,
    distance: 6.2,
    calories: 320,
    walkTime: "1h 24min"
  };

  const weeklySteps = [
    { day: "L", steps: 7200 },
    { day: "M", steps: 9100 },
    { day: "M", steps: 6800 },
    { day: "J", steps: 8900 },
    { day: "V", steps: 10200 },
    { day: "S", steps: 5400 },
    { day: "D", steps: 8247 }
  ];

  const maxSteps = Math.max(...weeklySteps.map(d => d.steps));

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-white">
      {/* En-tête */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/5216fdd6-d0d7-446b-9260-86d15d06f4ba.png" 
              alt="FitPaS" 
              className="h-8 w-auto"
              style={{ 
                filter: 'invert(0) sepia(1) saturate(5) hue-rotate(120deg) brightness(0.8)',
                color: '#10b981' 
              }}
            />
          </div>

          {/* Salutation */}
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Bonjour, {userProfile.firstName}
            </h1>
          </div>

          {/* Avatar et actions */}
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-gray-500 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarImage src={userProfile.avatar || undefined} />
              <AvatarFallback className="bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold">
                {userProfile.firstName.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 space-y-6 max-w-4xl mx-auto">
        {/* Carte Profil */}
        <Card className="bg-white shadow-lg border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Mes paramètres</h2>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full border-gray-200 hover:border-green-500 hover:text-green-600"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Modifier
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Genre</p>
                <p className="text-lg font-medium text-gray-900">{userProfile.gender}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Taille</p>
                <p className="text-lg font-medium text-gray-900">
                  {userProfile.height > 0 ? `${userProfile.height}m` : '-'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Poids</p>
                <p className="text-lg font-medium text-gray-900">
                  {userProfile.weight > 0 ? `${userProfile.weight}kg` : '-'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Âge</p>
                <p className="text-lg font-medium text-gray-900">
                  {userProfile.age > 0 ? `${userProfile.age} ans` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques du jour */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <Footprints className="h-8 w-8 mx-auto mb-2 opacity-90" />
              <p className="text-2xl font-bold">{todayStats.steps.toLocaleString()}</p>
              <p className="text-sm opacity-90">pas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-90" />
              <p className="text-2xl font-bold">{todayStats.distance}</p>
              <p className="text-sm opacity-90">km</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <Flame className="h-8 w-8 mx-auto mb-2 opacity-90" />
              <p className="text-2xl font-bold">{todayStats.calories}</p>
              <p className="text-sm opacity-90">kcal</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-90" />
              <p className="text-2xl font-bold">{todayStats.walkTime}</p>
              <p className="text-sm opacity-90">marche</p>
            </CardContent>
          </Card>
        </div>

        {/* Historique rapide */}
        <Card className="bg-white shadow-lg border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Cette semaine</h2>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                Voir plus
              </Button>
            </div>
            
            <div className="flex items-end justify-between space-x-2 h-32">
              {weeklySteps.map((day, index) => (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div 
                    className="w-full bg-gradient-to-t from-green-500 to-blue-500 rounded-t-lg transition-all duration-300 hover:scale-105"
                    style={{ 
                      height: `${(day.steps / maxSteps) * 80 + 20}px`,
                      minHeight: '20px'
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-2 font-medium">{day.day}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>0</span>
              <span>{(maxSteps / 1000).toFixed(0)}k pas</span>
            </div>
          </CardContent>
        </Card>

        {/* CTA Principal */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={onPlanifyWalk}
            className="h-14 px-12 text-lg font-semibold rounded-[14px] bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
          >
            <Footprints className="mr-3 h-6 w-6" />
            Planifier ma marche
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;