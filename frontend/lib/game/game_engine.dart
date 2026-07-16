import 'dart:math' as math;
import 'dart:ui';

enum GamePhase { menu, playing, paused, gameOver }

class Star {
  const Star(this.x, this.y, this.depth, this.phase);

  final double x;
  final double y;
  final double depth;
  final double phase;
}

class Meteor {
  Meteor({
    required this.position,
    required this.velocity,
    required this.radius,
    required this.rotation,
    required this.spin,
    required this.variant,
  });

  Offset position;
  final Offset velocity;
  final double radius;
  double rotation;
  final double spin;
  final int variant;
}

class EnergyOrb {
  EnergyOrb({
    required this.position,
    required this.speed,
    required this.phase,
  });

  Offset position;
  final double speed;
  final double phase;
}

class Spark {
  Spark({
    required this.position,
    required this.velocity,
    required this.life,
    required this.color,
    required this.size,
  }) : maxLife = life;

  Offset position;
  Offset velocity;
  double life;
  final double maxLife;
  final Color color;
  final double size;
}

/// Owns all deterministic gameplay state. Rendering and input stay in Flutter.
class NeonDriftEngine {
  NeonDriftEngine({math.Random? random}) : _random = random ?? math.Random();

  final math.Random _random;

  GamePhase phase = GamePhase.menu;
  Size worldSize = Size.zero;
  Offset player = Offset.zero;
  Offset target = Offset.zero;

  final List<Star> stars = <Star>[];
  final List<Meteor> meteors = <Meteor>[];
  final List<EnergyOrb> orbs = <EnergyOrb>[];
  final List<Spark> sparks = <Spark>[];

  double elapsed = 0;
  double score = 0;
  int bestScore = 0;
  int integrity = 3;
  int combo = 1;
  double comboWindow = 0;
  double charge = 0;
  double overdrive = 0;
  double invulnerability = 0;
  double shake = 0;
  double pulse = 0;

  double _meteorTimer = 0;
  double _orbTimer = 0;
  bool _gameOverJustTriggered = false;

  bool get isOverdrive => overdrive > 0;
  bool get isInvulnerable => invulnerability > 0;
  int get roundedScore => score.floor();
  bool get gameOverJustTriggered => _gameOverJustTriggered;

  void setBestScore(int value) {
    bestScore = value;
  }

  void resize(Size size) {
    if (size == Size.zero || size == worldSize) return;
    worldSize = size;
    if (stars.isEmpty) {
      for (var i = 0; i < 90; i++) {
        stars.add(Star(
          _random.nextDouble(),
          _random.nextDouble(),
          .25 + _random.nextDouble() * .75,
          _random.nextDouble() * math.pi * 2,
        ));
      }
    }
    if (player == Offset.zero) {
      player = Offset(size.width / 2, size.height * .78);
      target = player;
    } else {
      player = Offset(
        player.dx.clamp(30.0, size.width - 30),
        player.dy.clamp(size.height * .34, size.height - 55),
      );
      target = player;
    }
  }

  void start() {
    if (worldSize == Size.zero) return;
    phase = GamePhase.playing;
    elapsed = 0;
    score = 0;
    integrity = 3;
    combo = 1;
    comboWindow = 0;
    charge = 0;
    overdrive = 0;
    invulnerability = 0;
    shake = 0;
    pulse = 0;
    _meteorTimer = .45;
    _orbTimer = .9;
    _gameOverJustTriggered = false;
    meteors.clear();
    orbs.clear();
    sparks.clear();
    player = Offset(worldSize.width / 2, worldSize.height * .78);
    target = player;
    _emitBurst(player + const Offset(0, 20), const Color(0xFF5E7BFF), 20);
  }

  void togglePause() {
    if (phase == GamePhase.playing) {
      phase = GamePhase.paused;
    } else if (phase == GamePhase.paused) {
      phase = GamePhase.playing;
    }
  }

  void returnToMenu() {
    phase = GamePhase.menu;
    meteors.clear();
    orbs.clear();
    sparks.clear();
  }

  void moveTarget(Offset position) {
    if (phase != GamePhase.playing || worldSize == Size.zero) return;
    target = Offset(
      position.dx.clamp(28.0, worldSize.width - 28),
      position.dy.clamp(worldSize.height * .30, worldSize.height - 48),
    );
  }

  void update(double dt) {
    if (worldSize == Size.zero) return;
    _gameOverJustTriggered = false;
    pulse += dt;
    _updateSparks(dt);

    if (phase != GamePhase.playing) return;

    elapsed += dt;
    score += dt * (isOverdrive ? 26 : 13);
    comboWindow = math.max(0, comboWindow - dt);
    if (comboWindow == 0) combo = 1;
    overdrive = math.max(0, overdrive - dt);
    invulnerability = math.max(0, invulnerability - dt);
    shake = math.max(0, shake - dt * 26);

    final follow = 1 - math.pow(.0008, dt).toDouble();
    player = Offset.lerp(player, target, follow)!;

    _meteorTimer -= dt;
    if (_meteorTimer <= 0) {
      _spawnMeteor();
      final difficulty = (1.0 - elapsed * .012).clamp(.30, 1.0);
      _meteorTimer = difficulty * (.76 + _random.nextDouble() * .42);
    }

    _orbTimer -= dt;
    if (_orbTimer <= 0) {
      _spawnOrb();
      _orbTimer = .82 + _random.nextDouble() * .62;
    }

    _updateMeteors(dt);
    _updateOrbs(dt);
    _emitThruster(dt);
  }

  void _spawnMeteor() {
    final radius = 16 + _random.nextDouble() * 19;
    final x = radius + _random.nextDouble() * (worldSize.width - radius * 2);
    final speed = 155 + math.min(230, elapsed * 4.2) + _random.nextDouble() * 70;
    meteors.add(Meteor(
      position: Offset(x, -radius - 12),
      velocity: Offset((_random.nextDouble() - .5) * 44, speed),
      radius: radius,
      rotation: _random.nextDouble() * math.pi,
      spin: (_random.nextDouble() - .5) * 2.6,
      variant: _random.nextInt(3),
    ));
  }

  void _spawnOrb() {
    const margin = 34.0;
    orbs.add(EnergyOrb(
      position: Offset(
        margin + _random.nextDouble() * (worldSize.width - margin * 2),
        -30,
      ),
      speed: 125 + _random.nextDouble() * 55,
      phase: _random.nextDouble() * math.pi * 2,
    ));
  }

  void _updateMeteors(double dt) {
    final meteorSpeed = isOverdrive ? .72 : 1.0;
    for (final meteor in List<Meteor>.from(meteors)) {
      meteor.position += meteor.velocity * dt * meteorSpeed;
      meteor.rotation += meteor.spin * dt;
      if (meteor.position.dy > worldSize.height + meteor.radius + 10) {
        meteors.remove(meteor);
        continue;
      }

      final collisionDistance = meteor.radius + 15;
      if ((meteor.position - player).distance < collisionDistance) {
        meteors.remove(meteor);
        if (isOverdrive) {
          score += 120;
          _emitBurst(meteor.position, const Color(0xFFFDCB6E), 18);
        } else if (!isInvulnerable) {
          integrity -= 1;
          invulnerability = 1.15;
          shake = 11;
          combo = 1;
          comboWindow = 0;
          _emitBurst(player, const Color(0xFFFF4D8D), 28);
          if (integrity <= 0) {
            _finishGame();
            return;
          }
        }
      }
    }
  }

  void _updateOrbs(double dt) {
    for (final orb in List<EnergyOrb>.from(orbs)) {
      final wave = math.sin(elapsed * 3.2 + orb.phase) * 18;
      final desiredX = orb.position.dx + wave * dt;
      var next = Offset(desiredX, orb.position.dy + orb.speed * dt);

      if (isOverdrive) {
        final delta = player - next;
        if (delta.distance < 170) {
          next += Offset.fromDirection(delta.direction, 260 * dt);
        }
      }
      orb.position = next;

      if (orb.position.dy > worldSize.height + 30) {
        orbs.remove(orb);
        continue;
      }
      if ((orb.position - player).distance < 28) {
        orbs.remove(orb);
        combo = comboWindow > 0 ? math.min(8, combo + 1) : 1;
        comboWindow = 1.75;
        score += 45 * combo * (isOverdrive ? 2 : 1);
        charge = math.min(100, charge + 13 + combo * 1.5);
        _emitBurst(orb.position, const Color(0xFF42F5D7), 14);
        if (charge >= 100 && !isOverdrive) {
          charge = 0;
          overdrive = 5.5;
          invulnerability = 5.5;
          shake = 6;
          _emitBurst(player, const Color(0xFFB36BFF), 36);
        }
      }
    }
  }

  void _finishGame() {
    phase = GamePhase.gameOver;
    _gameOverJustTriggered = true;
    bestScore = math.max(bestScore, roundedScore);
    meteors.clear();
    orbs.clear();
  }

  void _emitThruster(double dt) {
    if (_random.nextDouble() > dt * 55) return;
    final color = isOverdrive
        ? const Color(0xFFB36BFF)
        : const Color(0xFF42F5D7);
    sparks.add(Spark(
      position: player + Offset((_random.nextDouble() - .5) * 9, 20),
      velocity: Offset(
        (_random.nextDouble() - .5) * 26,
        85 + _random.nextDouble() * 90,
      ),
      life: .24 + _random.nextDouble() * .32,
      color: color,
      size: 2 + _random.nextDouble() * 3,
    ));
  }

  void _emitBurst(Offset origin, Color color, int count) {
    for (var i = 0; i < count; i++) {
      final angle = _random.nextDouble() * math.pi * 2;
      final speed = 55 + _random.nextDouble() * 190;
      sparks.add(Spark(
        position: origin,
        velocity: Offset.fromDirection(angle, speed),
        life: .3 + _random.nextDouble() * .65,
        color: color,
        size: 2 + _random.nextDouble() * 4,
      ));
    }
  }

  void _updateSparks(double dt) {
    for (final spark in List<Spark>.from(sparks)) {
      spark.life -= dt;
      if (spark.life <= 0) {
        sparks.remove(spark);
        continue;
      }
      spark.position += spark.velocity * dt;
      spark.velocity = spark.velocity * math.pow(.06, dt).toDouble();
    }
  }
}
