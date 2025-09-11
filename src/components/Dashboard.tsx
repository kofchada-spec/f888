import { useState, useEffect } from 'react';
import { User, Edit3, Footprints, MapPin, Flame, Clock, LogOut, Crown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { ProfileEditModal } from '@/components/ProfileEditModal';
import { WeeklyStats } from '@/components/WeeklyStats';
import { Link } from 'react-router-dom';

interface DashboardProps {
  onPlanifyWalk: () => void;
}

const Dashboard = ({ onPlanifyWalk }: DashboardProps) => {
  const { signOut, user } = useAuth();
  const { subscriptionData } = useSubscription();
  const [userProfile, setUserProfile] = useState({
    firstName: "Utilisateur",
    gender: "-",
    height: 0,
    weight: 0,
    age: 0,
    avatar: null
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Load user profile from Supabase or localStorage
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        // Load from Supabase
      
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
      } else {
        // Load from localStorage
        try {
          const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
          if (localProfile) {
            setUserProfile({
              firstName: localProfile.first_name || "Utilisateur",
              gender: localProfile.gender || "-",
              height: localProfile.height_m || 0,
              weight: localProfile.weight_kg || 0,
              age: localProfile.age_years || 0,
              avatar: localProfile.avatar_url || null
            });
          }
        } catch (error) {
          console.error('Error loading local profile:', error);
        }
      }
    };

    loadUserProfile();
  }, [user]);

  const handleProfileUpdate = (updatedProfile: { weight: number; age: number }) => {
    setUserProfile(prev => ({
      ...prev,
      weight: updatedProfile.weight,
      age: updatedProfile.age
    }));
  };

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
            {/* Status d'abonnement */}
            {user && subscriptionData && (
              <Link to="/subscription">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  {subscriptionData.subscribed ? (
                    <>
                      <Crown className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Premium</span>
                    </>
                  ) : subscriptionData.inFreeTrial ? (
                    <>
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Essai gratuit</span>
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4" />
                      <span className="text-sm font-medium">S'abonner</span>
                    </>
                  )}
                </Button>
              </Link>
            )}
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
              <h2 className="text-lg font-semibold text-foreground">Mes paramètres</h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditModalOpen(true)}
                className="rounded-full border-border hover:border-primary hover:text-primary"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Modifier
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Genre</p>
                <p className="text-lg font-medium text-foreground">{userProfile.gender}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Taille</p>
                <p className="text-lg font-medium text-foreground">
                  {userProfile.height > 0 ? `${userProfile.height}m` : '-'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Poids</p>
                <p className="text-lg font-medium text-foreground">
                  {userProfile.weight > 0 ? `${userProfile.weight}kg` : '-'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Âge</p>
                <p className="text-lg font-medium text-foreground">
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

        {/* Statistiques de la semaine */}
        <WeeklyStats userProfile={{ height: userProfile.height, weight: userProfile.weight }} />

        {/* CTA Principal */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={onPlanifyWalk}
            className="h-14 px-12 text-lg font-semibold rounded-[14px] bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
          >
            <Footprints className="mr-3 h-6 w-6" />
            Planifier ma marche
          </Button>
        </div>
      </div>

      {/* Modal d'édition du profil */}
      <ProfileEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentProfile={{
          weight: userProfile.weight,
          age: userProfile.age,
          gender: userProfile.gender,
          height: userProfile.height
        }}
        onProfileUpdate={handleProfileUpdate}
      />
    </div>
  );
};

export default Dashboard;