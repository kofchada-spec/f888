import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TermsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TermsSheet = ({ open, onOpenChange }: TermsSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader>
          <SheetTitle>Conditions & Confidentialité</SheetTitle>
          <SheetDescription>
            Informations légales et politique de confidentialité
          </SheetDescription>
        </SheetHeader>
        
        <Tabs defaultValue="terms" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terms">CGU</TabsTrigger>
            <TabsTrigger value="privacy">Confidentialité</TabsTrigger>
          </TabsList>
          
          <TabsContent value="terms" className="mt-4">
            <ScrollArea className="h-[calc(85vh-180px)]">
              <div className="space-y-4 pr-4">
                <section>
                  <h3 className="font-semibold text-lg mb-2">1. Objet</h3>
                  <p className="text-sm text-muted-foreground">
                    Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation de l'application mobile FitPas. En utilisant l'application, vous acceptez ces conditions dans leur intégralité.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">2. Services proposés</h3>
                  <p className="text-sm text-muted-foreground">
                    FitPas est une application de fitness qui propose des fonctionnalités de planification et de suivi d'activités physiques (marche, course). L'application utilise les données de géolocalisation pour fournir des itinéraires personnalisés.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">3. Compte utilisateur</h3>
                  <p className="text-sm text-muted-foreground">
                    La création d'un compte nécessite une adresse email valide. Vous êtes responsable de la confidentialité de vos identifiants. Toute activité effectuée depuis votre compte est sous votre responsabilité.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">4. Abonnement</h3>
                  <p className="text-sm text-muted-foreground">
                    FitPas propose un abonnement premium donnant accès à des fonctionnalités avancées. L'abonnement est renouvelable automatiquement sauf résiliation. Les tarifs sont indiqués dans l'application et peuvent être modifiés avec préavis.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">5. Utilisation de la géolocalisation</h3>
                  <p className="text-sm text-muted-foreground">
                    L'application nécessite l'accès à votre localisation pour fonctionner correctement. Ces données sont utilisées uniquement pour générer des itinéraires et suivre vos activités.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">6. Propriété intellectuelle</h3>
                  <p className="text-sm text-muted-foreground">
                    Tous les éléments de l'application (design, textes, logos) sont protégés par le droit d'auteur. Toute reproduction non autorisée est interdite.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">7. Responsabilité</h3>
                  <p className="text-sm text-muted-foreground">
                    FitPas ne peut être tenu responsable des dommages directs ou indirects résultant de l'utilisation de l'application. L'utilisateur utilise l'application à ses propres risques, notamment lors d'activités physiques.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">8. Modifications des CGU</h3>
                  <p className="text-sm text-muted-foreground">
                    Nous nous réservons le droit de modifier ces CGU à tout moment. Les utilisateurs seront informés des modifications importantes.
                  </p>
                </section>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="privacy" className="mt-4">
            <ScrollArea className="h-[calc(85vh-180px)]">
              <div className="space-y-4 pr-4">
                <section>
                  <h3 className="font-semibold text-lg mb-2">1. Données collectées</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Nous collectons les données suivantes :
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Informations de compte (email, nom, prénom)</li>
                    <li>Données de localisation GPS</li>
                    <li>Données d'activité physique (distance, durée, vitesse)</li>
                    <li>Préférences et paramètres de l'application</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">2. Utilisation des données</h3>
                  <p className="text-sm text-muted-foreground">
                    Vos données sont utilisées pour fournir et améliorer nos services, personnaliser votre expérience, générer des itinéraires adaptés et analyser l'utilisation de l'application.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">3. Partage des données</h3>
                  <p className="text-sm text-muted-foreground">
                    Nous ne vendons pas vos données personnelles. Vos données peuvent être partagées avec des prestataires techniques (hébergement, paiement) dans le strict respect de la confidentialité.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">4. Sécurité</h3>
                  <p className="text-sm text-muted-foreground">
                    Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">5. Vos droits</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Conformément au RGPD, vous disposez des droits suivants :
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Droit d'accès à vos données</li>
                    <li>Droit de rectification</li>
                    <li>Droit à l'effacement</li>
                    <li>Droit à la portabilité</li>
                    <li>Droit d'opposition au traitement</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">6. Cookies et traceurs</h3>
                  <p className="text-sm text-muted-foreground">
                    L'application utilise des technologies de suivi pour améliorer l'expérience utilisateur et analyser l'utilisation. Vous pouvez contrôler ces préférences dans les paramètres.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">7. Conservation des données</h3>
                  <p className="text-sm text-muted-foreground">
                    Vos données sont conservées tant que votre compte est actif. Après suppression du compte, vos données sont effacées sous 30 jours, sauf obligation légale de conservation.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-2">8. Contact</h3>
                  <p className="text-sm text-muted-foreground">
                    Pour toute question concernant vos données personnelles, contactez-nous à : privacy@fitpas.app
                  </p>
                </section>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
