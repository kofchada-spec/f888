import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Footprints, MapPin, Flame, Clock } from 'lucide-react';
import { WeeklyCalendarModal } from '@/components/WeeklyCalendarModal';
import { useWalkStats } from '@/hooks/useWalkStats';

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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const { getWeeklyStats, getWeekTotals } = useWalkStats();
  
  // Get actual weekly data from walk sessions
  const weeklyStats = getWeeklyStats();
  const weekTotals = getWeekTotals();

  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <Card className="bg-card shadow-lg border-0">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Cette semaine - Marche</h2>
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

        {/* Graphique de la semaine avec gradient */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Progression de la semaine</h3>
          <div className="flex items-end justify-between space-x-2 h-20">
            {dayNames.map((dayName, index) => {
              const dayData = weeklyStats[index];
              const steps = dayData?.steps || 0;
              const maxSteps = Math.max(...weeklyStats.map(d => d.steps), 1); // Avoid division by zero
              const heightPercent = steps > 0 ? Math.max((steps / maxSteps) * 100, 8) : 0; // Minimum 8% for visibility
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full rounded-t transition-all relative overflow-hidden"
                    style={{ 
                      height: `${heightPercent}%`,
                      background: steps > 0 ? 'linear-gradient(to top, #4169E1, #9400D3)' : '#e5e7eb',
                      minHeight: steps > 0 ? '6px' : '2px'
                    }}
                  />
                  <span className="text-xs text-muted-foreground mt-1">{dayName}</span>
                  <span className="text-xs text-muted-foreground">{steps > 0 ? steps.toLocaleString() : ''}</span>
                </div>
              );
            })}
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