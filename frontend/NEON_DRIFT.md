# Neon Drift

Neon Drift is a portrait arcade game for Android built with Flutter. Drag the
ship to dodge meteors and collect energy cores. Chained pickups multiply the
score; a full energy meter activates temporary overdrive.

## Run on Android

```bash
flutter pub get
flutter run
```

Build an installable APK with:

```bash
flutter build apk --release
```

The APK is written to `build/app/outputs/flutter-apk/app-release.apk`.

## Controls

- Hold and drag anywhere in the playfield to steer.
- Collect cyan cores to charge overdrive and build a combo.
- Overdrive grants temporary protection and destroys meteors on contact.
- The game pauses from the top-right button and stores the best score locally.

All game art and effects are rendered procedurally, so play is fully offline
and no external asset or backend service is required.
