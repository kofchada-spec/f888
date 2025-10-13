# 📱 Configuration de l'Application Mobile

Votre application Fitpas est maintenant configurée pour fonctionner comme une app mobile native iOS et Android avec Capacitor !

## ✅ Ce qui est déjà fait

- ✅ Capacitor installé et configuré
- ✅ Configuration du hot-reload (l'app pointe vers votre preview Lovable)
- ✅ Plugin Motion pour le podomètre
- ✅ Plugin Keep Awake pour maintenir l'écran actif
- ✅ Plugin Background Geolocation pour le suivi GPS en arrière-plan
- ✅ Configuration des notifications pour le tracking en arrière-plan

## 🚀 Prochaines étapes (à faire sur votre machine)

### 1. Exporter vers GitHub

Dans Lovable :
1. Cliquez sur le bouton **GitHub** en haut à droite
2. Connectez votre compte GitHub si ce n'est pas déjà fait
3. Cliquez sur **"Connect to GitHub"** ou **"Create Repository"**

### 2. Cloner le projet sur votre machine

```bash
git clone https://github.com/VOTRE-USERNAME/VOTRE-REPO.git
cd VOTRE-REPO
```

### 3. Installer les dépendances

```bash
npm install
```

### 4. Ajouter les plateformes natives

#### Pour Android :
```bash
npx cap add android
```

#### Pour iOS (nécessite un Mac) :
```bash
npx cap add ios
```

### 5. Construire l'application web

```bash
npm run build
```

### 6. Synchroniser avec les plateformes natives

```bash
npx cap sync
```

### 7. Lancer l'application

#### Sur Android :
```bash
npx cap run android
```
Ou ouvrez le projet dans Android Studio :
```bash
npx cap open android
```

#### Sur iOS (Mac uniquement) :
```bash
npx cap run ios
```
Ou ouvrez le projet dans Xcode :
```bash
npx cap open ios
```

## 📝 Permissions requises

### Android (`android/app/src/main/AndroidManifest.xml`)

Les permissions suivantes sont nécessaires :

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### iOS (`ios/App/App/Info.plist`)

Ajoutez ces clés :

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Nous avons besoin de votre position pour suivre votre parcours</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Nous avons besoin de votre position en arrière-plan pour continuer le suivi de votre activité</string>
<key>NSMotionUsageDescription</key>
<string>Nous utilisons l'accéléromètre pour compter vos pas</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

## 🔄 Workflow de développement

### Mode développement (Hot Reload)

Par défaut, l'app pointe vers votre preview Lovable :
```
https://8af8d277-c44b-4c95-a879-2e40739d5fe8.lovableproject.com
```

Cela signifie que :
- ✅ Vous modifiez dans Lovable
- ✅ Les changements apparaissent automatiquement dans l'app mobile
- ✅ Pas besoin de rebuild

### Mode production

Pour compiler l'app avec le code en local :

1. Commentez la section `server` dans `capacitor.config.ts` :
```typescript
// server: {
//   androidScheme: 'https',
//   url: 'https://...',
//   cleartext: true
// }
```

2. Rebuild et sync :
```bash
npm run build
npx cap sync
```

## 🔧 Après chaque modification dans Lovable

Si vous modifiez dans Lovable et que GitHub est connecté :

```bash
git pull                    # Récupérer les changements
npm install                 # Au cas où de nouvelles dépendances
npx cap sync               # Synchroniser avec iOS/Android
```

## 🌟 Fonctionnalités natives activées

- ✅ **GPS en arrière-plan** : Le tracking continue même quand l'app est fermée
- ✅ **Podomètre** : Comptage de pas via l'accéléromètre
- ✅ **Notifications** : Notifications pendant le tracking
- ✅ **Keep Awake** : Empêche la mise en veille pendant l'activité
- ✅ **Haptiques** : Vibrations pour les feedbacks

## 📦 Déploiement en production

### Android (Google Play Store)

1. Générer une clé de signature
2. Configurer le fichier `build.gradle`
3. Générer un APK/AAB signé
4. Uploader sur Google Play Console

### iOS (App Store)

1. Configurer les certificats dans Apple Developer
2. Archive dans Xcode
3. Uploader via Xcode ou Transporter
4. Soumettre pour review

## 🆘 Besoin d'aide ?

- [Documentation Capacitor](https://capacitorjs.com/docs)
- [Documentation Lovable](https://docs.lovable.dev)
- [Troubleshooting Capacitor](https://capacitorjs.com/docs/troubleshooting)

## 📱 Tester sans build natif

Vous pouvez aussi utiliser **Capacitor Live Reload** pour tester sur un appareil physique sans passer par Android Studio/Xcode :

```bash
npx cap run android --livereload --external
```

Votre appareil doit être sur le même réseau WiFi que votre ordinateur.
