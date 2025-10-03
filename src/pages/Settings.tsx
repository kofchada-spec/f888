import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun, Bell, Globe, Ruler, Shield, Download, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState(i18n.language || 'fr');
  const [units, setUnits] = useState('metric');

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('fitpas-language', newLang);
  };

  const handleExportData = async () => {
    try {
      if (!user) {
        // Export from localStorage
        const localData = {
          profile: localStorage.getItem('userProfile'),
          onboarding: localStorage.getItem('fitpas-onboarding-complete'),
          walkSessions: localStorage.getItem('walkSessions'),
          runSessions: localStorage.getItem('runSessions'),
        };
        
        const blob = new Blob([JSON.stringify(localData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fitpas-data.json';
        a.click();
        
        toast({
          title: t('settings.toast.dataExported'),
          description: t('settings.toast.dataExportedDesc'),
        });
        return;
      }

      // Export from Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const exportData = {
        profile,
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fitpas-data.json';
      a.click();

      toast({
        title: t('settings.toast.dataExported'),
        description: t('settings.toast.dataExportedDesc'),
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: t('settings.toast.error'),
        description: t('settings.toast.exportError'),
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      if (!user) {
        // Clear localStorage
        localStorage.clear();
        toast({
          title: t('settings.toast.accountDeleted'),
          description: t('settings.toast.accountDeletedDesc'),
        });
        navigate('/');
        return;
      }

      // Delete from Supabase
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) throw error;

      toast({
        title: t('settings.toast.accountDeleted'),
        description: t('settings.toast.accountDeletedDesc'),
      });
      
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: t('settings.toast.error'),
        description: t('settings.toast.deleteError'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="px-6 py-4 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="mr-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{t('settings.title')}</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto p-6 space-y-6">
        {/* Application Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.app.title')}</CardTitle>
            <CardDescription>
              {t('settings.app.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">{t('settings.app.theme.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.app.theme.description')}
                  </p>
                </div>
              </div>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('settings.app.theme.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.app.theme.dark')}</SelectItem>
                  <SelectItem value="system">{t('settings.app.theme.system')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('settings.app.notifications.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.app.notifications.description')}
                  </p>
                </div>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>

            {/* Language */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('settings.app.language.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.app.language.description')}
                  </p>
                </div>
              </div>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">{t('languages.fr')}</SelectItem>
                  <SelectItem value="en">{t('languages.en')}</SelectItem>
                  <SelectItem value="es">{t('languages.es')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Units */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Ruler className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('settings.app.units.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.app.units.description')}
                  </p>
                </div>
              </div>
              <Select value={units} onValueChange={setUnits}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">{t('settings.app.units.metric')}</SelectItem>
                  <SelectItem value="imperial">{t('settings.app.units.imperial')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.privacy.title')}</CardTitle>
            <CardDescription>
              {t('settings.privacy.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Export Data */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportData}
            >
              <Download className="h-4 w-4 mr-3" />
              {t('settings.privacy.exportData')}
            </Button>

            {/* Delete Account */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-3" />
                  {t('settings.privacy.deleteAccount')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.privacy.deleteConfirm.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.privacy.deleteConfirm.description')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {t('settings.privacy.deleteConfirm.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Privacy Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{t('settings.privacy.dataProtection.title')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('settings.privacy.dataProtection.description')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
