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

        {/* Graphique en barres verticales */}
        <div className="bg-muted/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Progression de la semaine</h3>
          
          {/* Graphique */}
          <div className="relative">
            {/* Ligne d'objectif */}
            <div className="absolute w-full h-px bg-green-500 border-t-2 border-dashed border-green-500 z-10" style={{ top: '20px' }}>
              <span className="absolute right-0 -top-6 text-xs text-green-600 font-medium bg-white px-2 py-1 rounded shadow-sm">
                Objectif: 10k pas
              </span>
            </div>
            
            {/* Barres */}
            <div className="flex items-end justify-between space-x-2 h-48 pt-8">
              {dayNames.map((dayName, index) => {
                const dayData = weeklyStats[index];
                const steps = dayData?.steps || 0;
                const maxSteps = Math.max(...weeklyStats.map(d => d.steps), 10000);
                const heightPercent = maxSteps > 0 ? (steps / maxSteps) * 100 : 0;
                const goalReached = steps >= 10000;
                const isToday = index === 6; // Dimanche est aujourd'hui dans cet exemple
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group">
                    {/* Valeur au-dessus de la barre */}
                    {steps > 0 && (
                      <div className="mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-medium bg-gray-800 text-white px-2 py-1 rounded shadow-lg">
                          {steps.toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    {/* Barre */}
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-500 hover:shadow-lg relative ${
                        goalReached 
                          ? 'bg-gradient-to-t from-green-500 to-green-400' 
                          : steps > 0
                            ? isToday
                              ? 'bg-gradient-to-t from-primary to-primary/70'
                              : 'bg-gradient-to-t from-blue-500 to-blue-400'
                            : 'bg-muted-foreground/30'
                      } ${isToday ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      style={{ 
                        height: `${Math.max(heightPercent, steps > 0 ? 8 : 2)}%`,
                        minHeight: steps > 0 ? '12px' : '4px'
                      }}
                    >
                      {/* Effet de brillance */}
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-white/40 rounded-t-lg" />
                      
                      {/* Indicateur d'objectif atteint */}
                      {goalReached && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="text-lg">🎯</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Jour de la semaine */}
                    <div className="mt-2 text-center">
                      <span className={`text-sm font-medium ${
                        isToday ? 'text-primary font-bold' : 'text-foreground'
                      }`}>
                        {dayName}
                      </span>
                      {isToday && (
                        <div className="text-xs text-primary mt-1">Aujourd'hui</div>
                      )}
                    </div>
                    
                    {/* Pourcentage sous la barre */}
                    {steps > 0 && (
                      <div className="mt-1">
                        <span className={`text-xs ${
                          goalReached ? 'text-green-600 font-semibold' : 'text-muted-foreground'
                        }`}>
                          {Math.round((steps / 10000) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Échelle des valeurs (axe Y) */}
            <div className="absolute left-0 h-48 w-12 flex flex-col justify-between items-end pr-2 text-xs text-muted-foreground -ml-12">
              <span>{Math.max(...weeklyStats.map(d => d.steps), 10000).toLocaleString()}</span>
              <span>{Math.round(Math.max(...weeklyStats.map(d => d.steps), 10000) * 0.75).toLocaleString()}</span>
              <span>{Math.round(Math.max(...weeklyStats.map(d => d.steps), 10000) * 0.5).toLocaleString()}</span>
              <span>{Math.round(Math.max(...weeklyStats.map(d => d.steps), 10000) * 0.25).toLocaleString()}</span>
              <span>0</span>
            </div>
          </div>
          
          {/* Légende */}
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gradient-to-t from-blue-500 to-blue-400 rounded"></div>
              <span>Jours normaux</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gradient-to-t from-primary to-primary/70 rounded ring-1 ring-primary"></div>
              <span>Aujourd'hui</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gradient-to-t from-green-500 to-green-400 rounded"></div>
              <span>Objectif atteint 🎯</span>
            </div>
          </div>
          
          {/* Statistiques résumées */}
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