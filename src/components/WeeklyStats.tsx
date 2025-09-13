import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Footprints, MapPin, Flame, Clock } from 'lucide-react';
import { WeeklyCalendarModal } from '@/components/WeeklyCalendarModal';

export interface DayStats {
  dateISO: string;
  steps: number;
  distanceKm: number;
  kcal: number;
  walkMin: number;
}

interface WeeklyStatsProps {
  userProfile: {
    height: number;
    weight: number;
  };
}

export const WeeklyStats = ({ userProfile }: WeeklyStatsProps) => {
  const [weeklyStats, setWeeklyStats] = useState<DayStats[]>([]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Générer des données de démonstration pour la semaine
  const generateMockWeekData = (): DayStats[] => {
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 1);
    
    return days.map((day, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);
      
      // Générer des steps aléatoires entre 0 et 12000
      const steps = index === 6 ? 8247 : Math.floor(Math.random() * 12000);
      
      // Calculs basés sur les formules demandées
      const strideM = 0.415 * (userProfile.height || 1.75);
      const distanceKm = (steps * strideM) / 1000;
      const weight = userProfile.weight || 70;
      const kcal = Math.round(distanceKm * weight * 0.5); // coefficient modéré par défaut
      const walkMin = Math.round(steps / 115); // cadence modérée par défaut
      
      return {
        dateISO: date.toISOString().split('T')[0],
        steps,
        distanceKm: Math.round(distanceKm * 10) / 10,
        kcal,
        walkMin
      };
    });
  };

  useEffect(() => {
    // Charger ou générer les données de la semaine
    const savedStats = localStorage.getItem('weeklyStats');
    if (savedStats) {
      try {
        const parsed = JSON.parse(savedStats);
        setWeeklyStats(parsed);
      } catch {
        const newStats = generateMockWeekData();
        setWeeklyStats(newStats);
        localStorage.setItem('weeklyStats', JSON.stringify(newStats));
      }
    } else {
      const newStats = generateMockWeekData();
      setWeeklyStats(newStats);
      localStorage.setItem('weeklyStats', JSON.stringify(newStats));
    }
  }, [userProfile.height, userProfile.weight]);

  // Calculer les totaux
  const weekTotals = weeklyStats.reduce(
    (acc, day) => ({
      steps: acc.steps + day.steps,
      distanceKm: acc.distanceKm + day.distanceKm,
      kcal: acc.kcal + day.kcal,
      walkMin: acc.walkMin + day.walkMin
    }),
    { steps: 0, distanceKm: 0, kcal: 0, walkMin: 0 }
  );

  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <Card className="bg-card shadow-lg border-0">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Cette semaine</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary hover:text-primary/80"
            onClick={() => setIsCalendarOpen(true)}
          >
            Voir le détail
          </Button>
        </div>

        {/* Résumé totaux */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Footprints className="h-4 w-4 text-primary mr-1" />
            </div>
            <p className="text-sm text-muted-foreground">Total pas</p>
            <p className="text-lg font-semibold text-foreground">{weekTotals.steps.toLocaleString()}</p>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <MapPin className="h-4 w-4 text-secondary mr-1" />
            </div>
            <p className="text-sm text-muted-foreground">Total km</p>
            <p className="text-lg font-semibold text-foreground">{weekTotals.distanceKm.toFixed(1)}</p>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Flame className="h-4 w-4 text-orange-500 mr-1" />
            </div>
            <p className="text-sm text-muted-foreground">Total kcal</p>
            <p className="text-lg font-semibold text-foreground">{weekTotals.kcal.toLocaleString()}</p>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Clock className="h-4 w-4 text-purple-500 mr-1" />
            </div>
            <p className="text-sm text-muted-foreground">Total min</p>
            <p className="text-lg font-semibold text-foreground">{weekTotals.walkMin}</p>
          </div>
        </div>

        {/* Graphique en barres de la semaine */}
        <div className="bg-muted/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Progression de la semaine</h3>
          <div className="space-y-4">
            {/* Légende */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Objectif: 10 000 pas/jour</span>
              <span>Maximum: {Math.max(...weeklyStats.map(d => d.steps)).toLocaleString()} pas</span>
            </div>
            
            {/* Graphique */}
            <div className="space-y-3">
              {dayNames.map((dayName, index) => {
                const dayData = weeklyStats[index];
                const steps = dayData?.steps || 0;
                const maxSteps = Math.max(...weeklyStats.map(d => d.steps));
                const goalSteps = 10000;
                const widthPercent = maxSteps > 0 ? (steps / maxSteps) * 100 : 0;
                const goalWidthPercent = maxSteps > 0 ? (goalSteps / maxSteps) * 100 : 0;
                const isGoalReached = steps >= goalSteps;
                const isToday = index === 6; // Dimanche est le jour actuel dans cet exemple
                
                return (
                  <div key={index} className="space-y-1">
                    {/* En-tête de la barre */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium w-8 ${
                          isToday ? 'text-primary' : 'text-foreground'
                        }`}>
                          {dayName}
                        </span>
                        {isToday && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                            Aujourd'hui
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-semibold ${
                        isGoalReached ? 'text-green-600' : 'text-muted-foreground'
                      }`}>
                        {steps.toLocaleString()} pas
                      </span>
                    </div>
                    
                    {/* Barre de progression */}
                    <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                      {/* Barre de l'objectif (ligne de référence) */}
                      <div 
                        className="absolute top-0 left-0 h-full bg-gray-300/50 rounded-full"
                        style={{ width: `${Math.min(goalWidthPercent, 100)}%` }}
                      />
                      
                      {/* Barre des pas */}
                      <div 
                        className={`relative h-full rounded-full transition-all duration-500 ${
                          isGoalReached 
                            ? 'bg-gradient-to-r from-green-500 to-green-600' 
                            : steps > 0
                              ? 'bg-gradient-to-r from-primary to-primary/80'
                              : 'bg-muted-foreground/30'
                        }`}
                        style={{ width: `${Math.max(widthPercent, steps > 0 ? 3 : 0)}%` }}
                      >
                        {/* Effet de brillance */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />
                      </div>
                      
                      {/* Marqueur d'objectif */}
                      {goalWidthPercent <= 100 && (
                        <div 
                          className="absolute top-0 h-full w-0.5 bg-gray-600 z-10"
                          style={{ left: `${goalWidthPercent}%` }}
                        />
                      )}
                    </div>
                    
                    {/* Pourcentage de l'objectif */}
                    {steps > 0 && (
                      <div className="text-right">
                        <span className={`text-xs ${
                          isGoalReached ? 'text-green-600' : 'text-muted-foreground'
                        }`}>
                          {Math.round((steps / goalSteps) * 100)}% de l'objectif
                          {isGoalReached && ' 🎯'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Statistiques de la semaine */}
            <div className="mt-6 pt-4 border-t border-muted-foreground/20">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Jours actifs</p>
                  <p className="text-lg font-bold text-foreground">
                    {weeklyStats.filter(d => d.steps > 0).length}/7
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Objectifs atteints</p>
                  <p className="text-lg font-bold text-green-600">
                    {weeklyStats.filter(d => d.steps >= 10000).length}/7
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Moyenne/jour</p>
                  <p className="text-lg font-bold text-foreground">
                    {Math.round(weekTotals.steps / 7).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Calendrier */}
        <WeeklyCalendarModal 
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          weeklyStats={weeklyStats}
        />
      </CardContent>
    </Card>
  );
};