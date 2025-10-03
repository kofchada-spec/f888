import { useState, useEffect } from 'react';
import { User, Edit3, Footprints, MapPin, Flame, Clock, LogOut, Crown, Settings, UserCircle, CreditCard, HelpCircle, Target, Award, Zap } from 'lucide-react';
import { useWalkStats } from '@/hooks/useWalkStats';
import { useRunStats } from '@/hooks/useRunStats';
import { usePlanningLimiter } from '@/hooks/usePlanningLimiter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { ProfileEditModal } from '@/components/ProfileEditModal';
import { WeeklyStats } from '@/components/WeeklyStats';
import { RunWeeklyStats } from '@/components/RunWeeklyStats';
import { BadgeSystem } from '@/components/BadgeSystem';
import { Link, useNavigate } from 'react-router-dom';

interface DashboardProps {
  onPlanifyWalk: () => void;
  onPlanifyRun: () => void;
}

const Dashboard = ({ onPlanifyWalk, onPlanifyRun }: DashboardProps) => {
  const { signOut, user } = useAuth();
  const { subscriptionData } = useSubscription();
  const navigate = useNavigate();
  const { getTodayStats: getWalkTodayStats, getWeeklyStats: getWalkWeeklyStats, walkSessions } = useWalkStats();
  const { getTodayStats: getRunTodayStats, getWeeklyStats: getRunWeeklyStats, runSessions } = useRunStats();
  const { canPlan, remainingPlans, dailyLimit, bonusPlans, currentStreak: planningStreak } = usePlanningLimiter();
  const [userProfile, setUserProfile] = useState({
    firstName: "Utilisateur",
    gender: "-",
    height: 0,
    weight: 0,
    age: 0,
    avatar: null
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'walk' | 'run'>('all');

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

  const handleProfileUpdate = (updatedProfile: { weight: number; age: number; avatar: string | null }) => {
    setUserProfile(prev => ({
      ...prev,
      weight: updatedProfile.weight,
      age: updatedProfile.age,
      avatar: updatedProfile.avatar
    }));
  };

  // Get today's actual stats from walk and run sessions
  const walkTodayStats = getWalkTodayStats();
  const runTodayStats = getRunTodayStats();
  
  // Combined today stats
  const todayStats = {
    steps: walkTodayStats.steps + runTodayStats.steps,
    distanceKm: walkTodayStats.distanceKm + runTodayStats.distanceKm,
    calories: walkTodayStats.calories + runTodayStats.calories,
    activeTime: walkTodayStats.walkTime + runTodayStats.runTime
  };
  
  // Daily goals
  const dailyGoals = {
    steps: 10000,
    distanceKm: 8.0,
    calories: 400,
    activeTime: 60
  };

  // Calculate progress percentages based on active tab
  const getProgress = () => {
    if (activeTab === 'walk') {
      return {
        steps: Math.min((walkTodayStats.steps / dailyGoals.steps) * 100, 100),
        distanceKm: Math.min((walkTodayStats.distanceKm / dailyGoals.distanceKm) * 100, 100),
        calories: Math.min((walkTodayStats.calories / dailyGoals.calories) * 100, 100),
        activeTime: Math.min((walkTodayStats.walkTime / dailyGoals.activeTime) * 100, 100),
        stats: walkTodayStats
      };
    } else if (activeTab === 'run') {
      return {
        steps: Math.min((runTodayStats.steps / dailyGoals.steps) * 100, 100),
        distanceKm: Math.min((runTodayStats.distanceKm / dailyGoals.distanceKm) * 100, 100),
        calories: Math.min((runTodayStats.calories / dailyGoals.calories) * 100, 100),
        activeTime: Math.min((runTodayStats.runTime / dailyGoals.activeTime) * 100, 100),
        stats: { ...runTodayStats, walkTime: runTodayStats.runTime }
      };
    } else {
      return {
        steps: Math.min((todayStats.steps / dailyGoals.steps) * 100, 100),
        distanceKm: Math.min((todayStats.distanceKm / dailyGoals.distanceKm) * 100, 100),
        calories: Math.min((todayStats.calories / dailyGoals.calories) * 100, 100),
        activeTime: Math.min((todayStats.activeTime / dailyGoals.activeTime) * 100, 100),
        stats: { ...todayStats, walkTime: todayStats.activeTime }
      };
    }
  };

  const progress = getProgress();

  // Calculate current streak based on active tab
  const walkWeeklyStats = getWalkWeeklyStats();
  const runWeeklyStats = getRunWeeklyStats();
  
  const calculateStreak = (weekStats: any[], activityType: 'walk' | 'run' | 'all') => {
    let streak = 0;
    const today = new Date();
    
    // Check today first based on activity type
    const todayHasActivity = activityType === 'walk' 
      ? walkTodayStats.steps > 0
      : activityType === 'run'
      ? runTodayStats.steps > 0
      : todayStats.steps > 0;
    
    if (todayHasActivity) {
      streak = 1;
    }
    
    // Check previous days (max 7 days for now)
    for (let i = 1; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dayIndex = (checkDate.getDay() + 6) % 7; // Convert to 0=Monday format
      
      const dayHasActivity = activityType === 'walk'
        ? walkWeeklyStats[dayIndex]?.steps > 0
        : activityType === 'run'
        ? runWeeklyStats[dayIndex]?.steps > 0
        : (walkWeeklyStats[dayIndex]?.steps > 0 || runWeeklyStats[dayIndex]?.steps > 0);
      
      if (dayHasActivity) {
        if (i === 1 || streak > 0) { // Only continue streak if consecutive
          streak++;
        }
      } else {
        break; // Break streak if no activity
      }
    }
    
    return streak;
  };

  const currentStreak = calculateStreak(
    activeTab === 'walk' ? walkWeeklyStats : activeTab === 'run' ? runWeeklyStats : walkWeeklyStats,
    activeTab
  );

  // Calculate badge stats
  const walkBadgeStats = {
    totalDistance: walkSessions.reduce((sum, s) => sum + s.distanceKm, 0),
    totalSessions: walkSessions.length,
    streak: calculateStreak(walkWeeklyStats, 'walk')
  };

  const runBadgeStats = {
    totalDistance: runSessions.reduce((sum, s) => sum + s.distanceKm, 0),
    totalSessions: runSessions.length,
    streak: calculateStreak(runWeeklyStats, 'run')
  };

  // Motivational messages
  const getMotivationalMessage = () => {
    const overallProgress = (progress.steps + progress.distanceKm + progress.calories + progress.activeTime) / 4;
    
    if (overallProgress >= 100) {
      return "🎉 Objectifs atteints ! Fantastique !";
    } else if (overallProgress >= 75) {
      return "🔥 Presque au bout ! Continue comme ça !";
    } else if (overallProgress >= 50) {
      return "💪 Tu es à mi-chemin, c'est super !";
    } else if (overallProgress >= 25) {
      return "🚀 Bon début, continue sur ta lancée !";
    } else if (progress.stats.steps > 0) {
      return "👟 C'est parti ! Chaque pas compte !";
    } else {
      return "☀️ Nouvelle journée, nouveaux objectifs !";
    }
  };
  
  // Format walk time for display
  const formatWalkTime = (minutes: number) => {
    if (minutes === 0) return "0min";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${mins}min`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-white">
      {/* En-tête */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <img 
              src="/lovable-uploads/5216fdd6-d0d7-446b-9260-86d15d06f4ba.png" 
              alt="Fitpas" 
              className="h-8 w-auto hover:scale-105 transition-transform"
              style={{ 
                filter: 'invert(0) sepia(1) saturate(5) hue-rotate(120deg) brightness(0.8)',
                color: '#10b981' 
              }}
            />
          </div>

          {/* Espace central */}
          <div className="flex-1"></div>

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
            <Popover open={isAvatarMenuOpen} onOpenChange={setIsAvatarMenuOpen}>
              <PopoverTrigger asChild>
                <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
                  <AvatarImage src={userProfile.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold">
                    {userProfile.firstName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="end">
                <div className="py-2">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="font-medium text-sm text-foreground">{userProfile.firstName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsEditModalOpen(true);
                        setIsAvatarMenuOpen(false);
                      }}
                      className="w-full flex items-center px-3 py-2 text-sm text-foreground hover:bg-gray-50 transition-colors"
                    >
                      <UserCircle className="h-4 w-4 mr-3" />
                      Modifier mes informations
                    </button>
                    
                    <Link 
                      to="/subscription"
                      onClick={() => setIsAvatarMenuOpen(false)}
                      className="w-full flex items-center px-3 py-2 text-sm text-foreground hover:bg-gray-50 transition-colors"
                    >
                      <CreditCard className="h-4 w-4 mr-3" />
                      Gérer mes abonnements
                    </Link>
                    
                    <button
                      onClick={() => {
                        navigate('/service-client');
                        setIsAvatarMenuOpen(false);
                      }}
                      className="w-full flex items-center px-3 py-2 text-sm text-foreground hover:bg-gray-50 transition-colors"
                    >
                      <HelpCircle className="h-4 w-4 mr-3" />
                      Service client
                    </button>
                    
                    <button
                      onClick={() => {
                        // TODO: Implémenter les paramètres
                        setIsAvatarMenuOpen(false);
                      }}
                      className="w-full flex items-center px-3 py-2 text-sm text-foreground hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="h-4 w-4 mr-3" />
                      Paramètres
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={async () => {
                        await signOut();
                        navigate('/auth');
                        setIsAvatarMenuOpen(false);
                      }}
                      className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Se déconnecter
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 space-y-6 max-w-4xl mx-auto">
        {/* Carte Profil */}
        <Card className="bg-white shadow-lg border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Mes paramètres</h2>
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

        {/* Streak et Message Motivationnel */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Carte Streak */}
          <Card className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg border-0">
            <CardContent className="p-6 text-center">
              <Award className="h-8 w-8 mx-auto mb-3 opacity-90" />
              <p className="text-2xl font-bold">{currentStreak}</p>
              <p className="text-sm opacity-90">
                {currentStreak === 0 ? "Commence ta série !" : 
                 currentStreak === 1 ? "jour actif" : 
                 "jours consécutifs"}
              </p>
            </CardContent>
          </Card>

          {/* Choix d'activité */}
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg border-0">
            <CardContent className="p-6">
              <p className="text-center text-lg font-medium mb-4">☀️ Nouvelle journée, nouveaux objectifs !</p>
              <div className="flex gap-3">
                <Button
                  onClick={onPlanifyWalk}
                  disabled={!canPlan}
                  className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30 disabled:opacity-50"
                >
                  <Footprints className="mr-2 h-4 w-4" />
                  Marche
                </Button>
                <Button
                  onClick={onPlanifyRun}
                  disabled={!canPlan}
                  className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30 disabled:opacity-50"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Course
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Objectifs du jour avec barres de progression */}
        <Card className="bg-card shadow-lg border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground flex items-center">
                <Target className="h-5 w-5 mr-2 text-primary" />
                Mes objectifs du jour
              </h2>
              <div className="text-sm text-muted-foreground">
                {Math.round((progress.steps + progress.distanceKm + progress.calories + progress.activeTime) / 4)}% complétés
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Pas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Footprints className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm font-medium">Pas</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {progress.stats.steps.toLocaleString()} / {dailyGoals.steps.toLocaleString()}
                  </span>
                </div>
                <Progress value={progress.steps} className="h-2" />
              </div>

              {/* Distance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="text-sm font-medium">Distance</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {progress.stats.distanceKm.toFixed(1)} / {dailyGoals.distanceKm} km
                  </span>
                </div>
                <Progress value={progress.distanceKm} className="h-2" />
              </div>

              {/* Calories */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Flame className="h-4 w-4 mr-2 text-orange-500" />
                    <span className="text-sm font-medium">Calories</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {progress.stats.calories} / {dailyGoals.calories} kcal
                  </span>
                </div>
                <Progress value={progress.calories} className="h-2" />
              </div>

              {/* Temps actif */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-purple-500" />
                    <span className="text-sm font-medium">Temps actif</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatWalkTime(progress.stats.walkTime)} / {formatWalkTime(dailyGoals.activeTime)}
                  </span>
                </div>
                <Progress value={progress.activeTime} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Onglets Activités avec statistiques */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'walk' | 'run')} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Tout
            </TabsTrigger>
            <TabsTrigger value="walk" className="flex items-center gap-2">
              <Footprints className="h-4 w-4" />
              Marche
            </TabsTrigger>
            <TabsTrigger value="run" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Course
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <WeeklyStats userProfile={{ height: userProfile.height, weight: userProfile.weight }} />
            <RunWeeklyStats userProfile={{ height: userProfile.height, weight: userProfile.weight }} />
            <BadgeSystem 
              walkStats={walkBadgeStats} 
              runStats={runBadgeStats}
              activityType="all"
            />
          </TabsContent>

          <TabsContent value="walk" className="space-y-6">
            <WeeklyStats userProfile={{ height: userProfile.height, weight: userProfile.weight }} />
            <BadgeSystem 
              walkStats={walkBadgeStats} 
              runStats={runBadgeStats}
              activityType="walk"
            />
          </TabsContent>

          <TabsContent value="run" className="space-y-6">
            <RunWeeklyStats userProfile={{ height: userProfile.height, weight: userProfile.weight }} />
            <BadgeSystem 
              walkStats={walkBadgeStats} 
              runStats={runBadgeStats}
              activityType="run"
            />
          </TabsContent>
        </Tabs>

        {/* Planning limits info */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-200">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">Planifications aujourd'hui</p>
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">{remainingPlans}</span>
                  <span className="text-lg text-muted-foreground font-medium">sur {dailyLimit}</span>
                </div>
              </div>
              {bonusPlans > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                  <Award className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700 font-medium">
                    +{bonusPlans} bonus • Série {planningStreak}j
                  </span>
                </div>
              )}
              {!canPlan && (
                <p className="text-sm text-orange-600 mt-3 font-medium">
                  Limite atteinte - Complétez une activité pour maintenir votre série !
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CTA Principal */}
        <div className="flex flex-col items-center gap-4 pt-4">
          <Button
            onClick={onPlanifyWalk}
            disabled={!canPlan}
            className="h-14 px-12 text-lg font-semibold rounded-[14px] bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <Footprints className="mr-3 h-6 w-6" />
            Planifier ma marche
          </Button>
          
          <Button
            onClick={onPlanifyRun}
            disabled={!canPlan}
            className="h-14 px-12 text-lg font-semibold rounded-[14px] bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <Zap className="mr-3 h-6 w-6" />
            Planifier ma course
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
          height: userProfile.height,
          avatar: userProfile.avatar
        }}
        onProfileUpdate={handleProfileUpdate}
      />
    </div>
  );
};

export default Dashboard;