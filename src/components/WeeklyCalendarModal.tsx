import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Footprints, MapPin, Flame, Clock } from 'lucide-react';
import { DayStats } from '@/components/WeeklyStats';

interface WeeklyCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  weeklyStats: DayStats[];
}

export const WeeklyCalendarModal = ({ isOpen, onClose, weeklyStats }: WeeklyCalendarModalProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get current month info
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Create calendar grid
  const calendarDays = [];
  const today = new Date();

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null);
  }

  // Add days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateISO = date.toISOString().split('T')[0];
    const dayData = weeklyStats.find(stat => stat.dateISO === dateISO);
    
    calendarDays.push({
      day,
      date,
      dateISO,
      stats: dayData,
      isToday: date.toDateString() === today.toDateString()
    });
  }

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Calendrier d'activité</DialogTitle>
        </DialogHeader>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigateMonth('prev')}
            className="p-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <h2 className="text-xl font-semibold">
            {monthNames[month]} {year}
          </h2>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigateMonth('next')}
            className="p-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((dayInfo, index) => (
            <Card 
              key={index} 
              className={`min-h-[120px] ${
                !dayInfo 
                  ? 'invisible' 
                  : dayInfo.isToday 
                    ? 'ring-2 ring-primary' 
                    : dayInfo.stats && dayInfo.stats.steps > 0
                      ? 'bg-muted/30'
                      : 'bg-background'
              }`}
            >
              <CardContent className="p-2">
                {dayInfo && (
                  <>
                    <div className={`text-sm font-medium mb-2 ${
                      dayInfo.isToday ? 'text-primary' : 'text-foreground'
                    }`}>
                      {dayInfo.day}
                    </div>
                    
                    {dayInfo.stats && dayInfo.stats.steps > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Footprints className="h-3 w-3 mr-1" />
                          <span>{dayInfo.stats.steps.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span>{dayInfo.stats.distanceKm.toFixed(1)}km</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Flame className="h-3 w-3 mr-1" />
                          <span>{dayInfo.stats.kcal}</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>{dayInfo.stats.walkMin}min</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/50">
                        Pas d'activité
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};