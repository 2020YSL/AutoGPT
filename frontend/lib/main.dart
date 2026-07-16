import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'game/game_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations(
    const <DeviceOrientation>[DeviceOrientation.portraitUp],
  );
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  runApp(const NeonDriftApp());
}

class NeonDriftApp extends StatelessWidget {
  const NeonDriftApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Neon Drift',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF050714),
        fontFamily: 'sans-serif',
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF5E7BFF),
          secondary: Color(0xFF42F5D7),
          surface: Color(0xFF111735),
        ),
        useMaterial3: true,
      ),
      home: const GameScreen(),
    );
  }
}
