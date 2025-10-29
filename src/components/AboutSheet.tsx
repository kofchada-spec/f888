import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, Target, Users, Zap } from "lucide-react";

interface AboutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AboutSheet = ({ open, onOpenChange }: AboutSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader>
          <SheetTitle>À propos de FitPas</SheetTitle>
          <SheetDescription>
            Votre compagnon fitness quotidien
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(85vh-120px)] mt-6">
          <div className="space-y-6 pr-4">
            <section className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white">
                  <Heart className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-xl">Notre Mission</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                FitPas a pour mission de rendre l'activité physique accessible, motivante et 
                personnalisée pour tous. Nous croyons que chaque pas compte et que la technologie 
                peut être un allié précieux dans votre parcours de bien-être.
              </p>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white">
                  <Target className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-xl">Notre Vision</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Nous imaginons un monde où chacun peut atteindre ses objectifs de fitness de 
                manière simple et agréable. FitPas combine intelligence artificielle et données 
                géographiques pour créer des expériences d'entraînement uniques et adaptées à 
                votre environnement.
              </p>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-xl">Nos Valeurs</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <div>
                    <strong className="text-foreground">Innovation</strong>
                    <p className="text-sm text-muted-foreground">
                      Nous utilisons les dernières technologies pour améliorer votre expérience
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <div>
                    <strong className="text-foreground">Accessibilité</strong>
                    <p className="text-sm text-muted-foreground">
                      Le fitness doit être accessible à tous, quel que soit le niveau
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <div>
                    <strong className="text-foreground">Personnalisation</strong>
                    <p className="text-sm text-muted-foreground">
                      Chaque utilisateur est unique et mérite une expérience sur mesure
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold mt-0.5">•</span>
                  <div>
                    <strong className="text-foreground">Confidentialité</strong>
                    <p className="text-sm text-muted-foreground">
                      Vos données vous appartiennent et sont protégées
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-xl">L'Équipe</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                FitPas est développé par une équipe passionnée de développeurs, designers et 
                experts en fitness. Nous travaillons chaque jour pour améliorer l'application 
                et vous offrir la meilleure expérience possible.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold text-xl">Fonctionnalités Principales</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Planification intelligente d'itinéraires de marche et course
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Suivi GPS en temps réel de vos activités
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Statistiques détaillées et historique complet
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Système de badges et récompenses motivant
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Découverte de nouveaux parcours dans votre ville
                </li>
              </ul>
            </section>

            <section className="space-y-3 pt-4 border-t border-border">
              <h3 className="font-semibold text-xl">Contact</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>📧 Email: support@fitpas.app</p>
                <p>🌐 Site web: fitpas.app</p>
                <p>📱 Version: 1.0.0</p>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
