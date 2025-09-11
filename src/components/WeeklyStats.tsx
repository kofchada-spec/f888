import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Footprints, MapPin, Flame, Clock } from 'lucide-react';

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
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
            Voir le détail
          </Button>
        </div>

        {/* Résumé totaux */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

        {/* Détail par jour */}
        <div className="space-y-3">
          {dayNames.map((dayName, index) => {
            const dayData = weeklyStats[index];
            const hasData = dayData && dayData.steps > 0;
            
            return (
              <div
                key={index}
                className={`grid grid-cols-5 gap-4 p-3 rounded-lg transition-colors ${
                  hasData ? 'bg-background border border-border' : 'bg-muted/30'
                }`}
              >
                <div className="text-center font-medium">
                  <p className={`text-sm ${hasData ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {dayName}
                  </p>
                </div>
                
                <div className="text-center">
                  <p className={`text-xs ${hasData ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                    Pas
                  </p>
                  <p className={`font-medium ${hasData ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                    {hasData ? dayData.steps.toLocaleString() : '0'}
                  </p>
                </div>
                
                <div className="text-center">
                  <p className={`text-xs ${hasData ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                    Km
                  </p>
                  <p className={`font-medium ${hasData ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                    {hasData ? dayData.distanceKm.toFixed(1) : '0'}
                  </p>
                </div>
                
                <div className="text-center">
                  <p className={`text-xs ${hasData ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                    Kcal
                  </p>
                  <p className={`font-medium ${hasData ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                    {hasData ? dayData.kcal : '0'}
                  </p>
                </div>
                
                <div className="text-center">
                  <p className={`text-xs ${hasData ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                    Min
                  </p>
                  <p className={`font-medium ${hasData ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                    {hasData ? dayData.walkMin : '0'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};