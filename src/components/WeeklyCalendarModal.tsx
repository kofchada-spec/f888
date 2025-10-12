import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Footprints, MapPin, Flame, Clock } from 'lucide-react';
import { DayStats } from '@/components/WeeklyStats';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WeeklyCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  weeklyStats: DayStats[];
}

interface CalendarDay {
  day: number;
  date: Date;
  dateISO: string;
  stats?: DayStats;
  isToday: boolean;
}

export const WeeklyCalendarModal = ({ isOpen, onClose, weeklyStats }: WeeklyCalendarModalProps) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [allActivities, setAllActivities] = useState<DayStats[]>([]);

  // Load all activities from Supabase for the calendar
  useEffect(() => {
    if (!user) return;

    const loadAllActivities = async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error loading activities:', error);
        return;
      }

      if (data) {
        // Group activities by date
        const activityMap = new Map<string, DayStats>();
        
        data.forEach(activity => {
          const dateISO = activity.date;
          const existing = activityMap.get(dateISO) || {
            dateISO,
            steps: 0,
            distanceKm: 0,
            kcal: 0,
            walkMin: 0
          };
          
          activityMap.set(dateISO, {
            dateISO,
            steps: existing.steps + activity.steps,
            distanceKm: existing.distanceKm + Number(activity.distance_km),
            kcal: existing.kcal + activity.calories,
            walkMin: existing.walkMin + activity.duration_min
          });
        });

        setAllActivities(Array.from(activityMap.values()));
      }
    };

    loadAllActivities();
  }, [user]);

  // Helper to get local date string
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
    const dateISO = getLocalDateString(date);
    // Look in allActivities instead of just weeklyStats
    const dayData = allActivities.find(stat => stat.dateISO === dateISO);
    
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

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

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
    setSelectedDay(null); // Reset selection when changing month
  };

  const handleDayClick = (dayInfo: CalendarDay) => {
    setSelectedDay(dayInfo);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
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
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {/* Day headers */}
          {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (
            <div key={day} className="text-center text-xs md:text-sm font-medium text-muted-foreground p-1 md:p-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((dayInfo, index) => (
            <Card 
              key={index} 
              className={`min-h-[80px] md:min-h-[120px] transition-all duration-200 ${
                !dayInfo 
                  ? 'invisible' 
                  : selectedDay?.dateISO === dayInfo.dateISO
                    ? 'ring-2 ring-primary bg-primary/10 shadow-lg cursor-pointer'
                    : dayInfo.isToday 
                      ? 'ring-1 md:ring-2 ring-primary cursor-pointer hover:shadow-md hover:bg-primary/5' 
                      : dayInfo.stats && dayInfo.stats.steps > 0
                        ? 'bg-muted/30 hover:bg-muted/50 cursor-pointer hover:shadow-md hover:scale-105'
                        : 'bg-background hover:bg-muted/20 cursor-pointer hover:shadow-sm'
              }`}
              onClick={() => dayInfo && handleDayClick(dayInfo)}
            >
              <CardContent className="p-1 md:p-2 h-full flex flex-col">
                {dayInfo && (
                  <>
                    <div className={`text-xs md:text-sm font-medium mb-1 md:mb-2 ${
                      dayInfo.isToday ? 'text-primary' : 'text-foreground'
                    }`}>
                      {dayInfo.day}
                    </div>
                    
                    {dayInfo.stats && dayInfo.stats.steps > 0 ? (
                      <div className="space-y-0.5 md:space-y-1 flex-1 overflow-hidden">
                        <div className="flex items-center text-xs text-muted-foreground truncate">
                          <Footprints className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{dayInfo.stats.steps > 999 ? `${Math.round(dayInfo.stats.steps/1000)}k` : dayInfo.stats.steps}</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-muted-foreground truncate">
                          <MapPin className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{dayInfo.stats.distanceKm.toFixed(1)}km</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-muted-foreground truncate">
                          <Flame className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{dayInfo.stats.kcal}</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-muted-foreground truncate">
                          <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{dayInfo.stats.walkMin}min</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/50">
                        -
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Day Detail Section */}
        {selectedDay && (
          <Card className="mt-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    {dayNames[selectedDay.date.getDay()]} {selectedDay.day} {monthNames[selectedDay.date.getMonth()]} {selectedDay.date.getFullYear()}
                  </h3>
                  {selectedDay.isToday && (
                    <span className="inline-flex items-center text-sm bg-primary text-primary-foreground px-3 py-1 rounded-full mt-2">
                      ✨ Aujourd'hui
                    </span>
                  )}
                </div>
              </div>
              
              {selectedDay.stats && selectedDay.stats.steps > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-primary/10">
                    <div className="flex items-center justify-center mb-3">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Footprints className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-foreground mb-1">{selectedDay.stats.steps.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">pas</p>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-secondary/10">
                    <div className="flex items-center justify-center mb-3">
                      <div className="p-3 bg-secondary/10 rounded-full">
                        <MapPin className="h-6 w-6 text-secondary" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-foreground mb-1">{selectedDay.stats.distanceKm.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">kilomètres</p>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-orange-200">
                    <div className="flex items-center justify-center mb-3">
                      <div className="p-3 bg-orange-100 rounded-full">
                        <Flame className="h-6 w-6 text-orange-500" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-foreground mb-1">{selectedDay.stats.kcal}</p>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">calories</p>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-purple-200">
                    <div className="flex items-center justify-center mb-3">
                      <div className="p-3 bg-purple-100 rounded-full">
                        <Clock className="h-6 w-6 text-purple-500" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-foreground mb-1">{selectedDay.stats.walkMin}</p>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">minutes</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-muted-foreground/30 mb-4">
                    <Footprints className="h-16 w-16 mx-auto" />
                  </div>
                  <p className="text-xl font-medium text-muted-foreground mb-2">Aucune activité enregistrée</p>
                  <p className="text-sm text-muted-foreground/80">Commencez votre journée avec une marche !</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between items-center mt-6">
          {selectedDay && (
            <Button variant="outline" onClick={() => setSelectedDay(null)}>
              Désélectionner
            </Button>
          )}
          <Button onClick={onClose} className={selectedDay ? "ml-auto" : "mx-auto"}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};