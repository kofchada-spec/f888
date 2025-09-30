import { Award, Flame, Target, Trophy, Zap, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BadgeItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
  category: 'walk' | 'run' | 'general';
}

interface BadgeSystemProps {
  walkStats: {
    totalDistance: number;
    totalSessions: number;
    streak: number;
  };
  runStats: {
    totalDistance: number;
    totalSessions: number;
    streak: number;
  };
  activityType?: 'walk' | 'run' | 'all';
}

export const BadgeSystem = ({ walkStats, runStats, activityType = 'all' }: BadgeSystemProps) => {
  const badges: BadgeItem[] = [
    // Marche badges
    {
      id: 'first-walk',
      title: 'Premier Pas',
      description: 'Complète ta première marche',
      icon: <Award className="h-5 w-5" />,
      unlocked: walkStats.totalSessions >= 1,
      category: 'walk'
    },
    {
      id: 'walk-5km',
      title: 'Marcheur 5km',
      description: 'Marche un total de 5km',
      icon: <Target className="h-5 w-5" />,
      unlocked: walkStats.totalDistance >= 5,
      progress: Math.min(walkStats.totalDistance, 5),
      maxProgress: 5,
      category: 'walk'
    },
    {
      id: 'walk-streak-7',
      title: 'Semaine Active',
      description: '7 jours consécutifs de marche',
      icon: <Flame className="h-5 w-5" />,
      unlocked: walkStats.streak >= 7,
      progress: Math.min(walkStats.streak, 7),
      maxProgress: 7,
      category: 'walk'
    },
    {
      id: 'walk-10-sessions',
      title: 'Régularité',
      description: 'Complète 10 marches',
      icon: <Star className="h-5 w-5" />,
      unlocked: walkStats.totalSessions >= 10,
      progress: Math.min(walkStats.totalSessions, 10),
      maxProgress: 10,
      category: 'walk'
    },
    
    // Course badges
    {
      id: 'first-run',
      title: 'Premier Sprint',
      description: 'Complète ta première course',
      icon: <Zap className="h-5 w-5" />,
      unlocked: runStats.totalSessions >= 1,
      category: 'run'
    },
    {
      id: 'run-5km',
      title: 'Coureur 5km',
      description: 'Cours un total de 5km',
      icon: <Target className="h-5 w-5" />,
      unlocked: runStats.totalDistance >= 5,
      progress: Math.min(runStats.totalDistance, 5),
      maxProgress: 5,
      category: 'run'
    },
    {
      id: 'run-streak-7',
      title: 'Endurance',
      description: '7 jours consécutifs de course',
      icon: <Flame className="h-5 w-5" />,
      unlocked: runStats.streak >= 7,
      progress: Math.min(runStats.streak, 7),
      maxProgress: 7,
      category: 'run'
    },
    {
      id: 'run-10-sessions',
      title: 'Marathonien',
      description: 'Complète 10 courses',
      icon: <Trophy className="h-5 w-5" />,
      unlocked: runStats.totalSessions >= 10,
      progress: Math.min(runStats.totalSessions, 10),
      maxProgress: 10,
      category: 'run'
    },
    
    // General badges
    {
      id: 'total-50km',
      title: 'Champion',
      description: '50km combinés (marche + course)',
      icon: <Trophy className="h-5 w-5" />,
      unlocked: (walkStats.totalDistance + runStats.totalDistance) >= 50,
      progress: Math.min(walkStats.totalDistance + runStats.totalDistance, 50),
      maxProgress: 50,
      category: 'general'
    }
  ];

  const filteredBadges = activityType === 'all' 
    ? badges 
    : badges.filter(b => b.category === activityType || b.category === 'general');

  const unlockedBadges = filteredBadges.filter(b => b.unlocked);
  const lockedBadges = filteredBadges.filter(b => !b.unlocked);

  return (
    <Card className="bg-card shadow-lg border-0">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
            Mes badges
          </h2>
          <Badge variant="secondary">
            {unlockedBadges.length}/{filteredBadges.length}
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Unlocked badges */}
          {unlockedBadges.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Débloqués</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {unlockedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={cn(
                      "relative p-4 rounded-lg border-2 transition-all",
                      "bg-gradient-to-br from-yellow-50 to-orange-50",
                      "border-yellow-400 shadow-md"
                    )}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-2 text-yellow-600">{badge.icon}</div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">
                        {badge.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Locked badges with progress */}
          {lockedBadges.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">À débloquer</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {lockedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={cn(
                      "relative p-4 rounded-lg border-2 transition-all",
                      "bg-muted/20 border-muted opacity-60"
                    )}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-2 text-muted-foreground">{badge.icon}</div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">
                        {badge.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        {badge.description}
                      </p>
                      {badge.progress !== undefined && badge.maxProgress && (
                        <div className="w-full mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{badge.progress.toFixed(1)}</span>
                            <span>{badge.maxProgress}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${(badge.progress / badge.maxProgress) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};