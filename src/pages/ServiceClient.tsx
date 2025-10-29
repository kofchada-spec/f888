import { ArrowLeft, MessageSquare, Book, Mail, Lightbulb, Star, FileText, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useState } from 'react';
import { SuggestionModal } from '@/components/SuggestionModal';
import { TermsSheet } from '@/components/TermsSheet';
import { AboutSheet } from '@/components/AboutSheet';

const ServiceClient = () => {
  const navigate = useNavigate();
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isTermsSheetOpen, setIsTermsSheetOpen] = useState(false);
  const [isAboutSheetOpen, setIsAboutSheetOpen] = useState(false);

  const handleContact = () => {
    toast.info("Contactez-nous à support@fitpas.app");
  };

  const handleFAQ = () => {
    toast.info("Section FAQ en cours de développement");
  };

  const handleSuggestion = () => {
    setIsSuggestionModalOpen(true);
  };

  const handleRate = () => {
    const userAgent = navigator.userAgent || navigator.vendor;
    
    // Detect iOS
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      window.open('https://apps.apple.com/app/fitpas', '_blank');
    }
    // Detect Android
    else if (/android/i.test(userAgent)) {
      window.open('https://play.google.com/store/apps/details?id=com.fitpas.app', '_blank');
    }
    // Web fallback
    else {
      toast.info("Veuillez évaluer FitPas sur votre store mobile (App Store ou Google Play)");
    }
  };

  const handleTerms = () => {
    setIsTermsSheetOpen(true);
  };

  const handleAbout = () => {
    setIsAboutSheetOpen(true);
  };

  const menuItems = [
    {
      icon: Book,
      title: "Centre d'aide",
      description: "Articles et tutoriels",
      color: "from-purple-500 to-pink-500",
      action: handleFAQ
    },
    {
      icon: Mail,
      title: "Contact & Support",
      description: "Signaler un problème",
      color: "from-green-500 to-emerald-500",
      action: handleContact
    },
    {
      icon: Lightbulb,
      title: "Suggérer une idée",
      description: "Proposer une fonctionnalité",
      color: "from-yellow-500 to-orange-500",
      action: handleSuggestion
    },
    {
      icon: Star,
      title: "Évaluer l'app",
      description: "Laisser un avis",
      color: "from-pink-500 to-rose-500",
      action: handleRate
    },
    {
      icon: FileText,
      title: "CGU & Confidentialité",
      description: "Conditions d'utilisation",
      color: "from-slate-500 to-gray-600",
      action: handleTerms
    },
    {
      icon: Info,
      title: "À propos",
      description: "En savoir plus sur FitPas",
      color: "from-indigo-500 to-blue-600",
      action: handleAbout
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border/50 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Service Client</h1>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 space-y-3 max-w-2xl mx-auto pb-6">
        {menuItems.map((item, index) => (
          <Card 
            key={index}
            onClick={item.action}
            className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98] border-border/50"
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${item.color} text-white`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SuggestionModal 
        open={isSuggestionModalOpen}
        onOpenChange={setIsSuggestionModalOpen}
      />
      
      <TermsSheet 
        open={isTermsSheetOpen}
        onOpenChange={setIsTermsSheetOpen}
      />

      <AboutSheet 
        open={isAboutSheetOpen}
        onOpenChange={setIsAboutSheetOpen}
      />
    </div>
  );
};

export default ServiceClient;
