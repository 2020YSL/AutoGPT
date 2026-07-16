import 'dart:math' as math;
import 'dart:ui';

import 'package:auto_gpt_flutter_client/game/game_engine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('NeonDriftEngine', () {
    late NeonDriftEngine engine;

    setUp(() {
      engine = NeonDriftEngine(random: math.Random(7));
      engine.resize(const Size(400, 800));
      engine.start();
    });

    test('starts a fresh playable session', () {
      expect(engine.phase, GamePhase.playing);
      expect(engine.integrity, 3);
      expect(engine.roundedScore, 0);
      expect(engine.player, const Offset(200, 624));
    });

    test('clamps touch input to the playable area', () {
      engine.moveTarget(const Offset(-200, 1200));

      expect(engine.target.dx, 28);
      expect(engine.target.dy, 752);
    });

    test('collecting energy increases charge and score', () {
      engine.orbs.add(EnergyOrb(
        position: engine.player,
        speed: 0,
        phase: 0,
      ));

      engine.update(.01);

      expect(engine.orbs, isEmpty);
      expect(engine.charge, greaterThan(0));
      expect(engine.roundedScore, greaterThanOrEqualTo(45));
    });

    test('three unshielded impacts end the run', () {
      for (var hit = 0; hit < 3; hit++) {
        engine.invulnerability = 0;
        engine.meteors.add(Meteor(
          position: engine.player,
          velocity: Offset.zero,
          radius: 20,
          rotation: 0,
          spin: 0,
          variant: 0,
        ));
        engine.update(.01);
      }

      expect(engine.phase, GamePhase.gameOver);
      expect(engine.integrity, 0);
      expect(engine.gameOverJustTriggered, isTrue);
    });
  });
}
