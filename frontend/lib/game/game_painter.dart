// ignore_for_file: deprecated_member_use

import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'game_engine.dart';

class NeonDriftPainter extends CustomPainter {
  NeonDriftPainter(this.engine);

  final NeonDriftEngine engine;

  static const Color _ink = Color(0xFF060817);
  static const Color _cyan = Color(0xFF42F5D7);
  static const Color _blue = Color(0xFF5E7BFF);
  static const Color _purple = Color(0xFFB36BFF);
  static const Color _pink = Color(0xFFFF4D8D);

  @override
  void paint(Canvas canvas, Size size) {
    _paintBackground(canvas, size);

    canvas.save();
    if (engine.shake > 0) {
      canvas.translate(
        math.sin(engine.pulse * 73) * engine.shake,
        math.cos(engine.pulse * 61) * engine.shake * .65,
      );
    }
    _paintOrbs(canvas);
    _paintMeteors(canvas);
    _paintSparks(canvas);
    if (engine.phase != GamePhase.menu) _paintShip(canvas);
    canvas.restore();
  }

  void _paintBackground(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[
            Color(0xFF050714),
            Color(0xFF0A1027),
            Color(0xFF101338),
            _ink,
          ],
          stops: <double>[0, .38, .72, 1],
        ).createShader(Offset.zero & size),
    );

    _paintNebula(
      canvas,
      Offset(size.width * (.15 + math.sin(engine.pulse * .08) * .04),
          size.height * .25),
      size.width * .62,
      _purple,
    );
    _paintNebula(
      canvas,
      Offset(size.width * .92, size.height * .63),
      size.width * .75,
      _blue,
    );

    final starPaint = Paint()..strokeCap = StrokeCap.round;
    for (final star in engine.stars) {
      final speed = engine.phase == GamePhase.playing
          ? (engine.isOverdrive ? 190 : 52)
          : 9;
      final y = (star.y * size.height +
              engine.elapsed * speed * star.depth +
              engine.pulse * 2) %
          size.height;
      final x = star.x * size.width;
      final twinkle =
          .45 + .55 * math.sin(engine.pulse * (1.2 + star.depth) + star.phase);
      starPaint.color =
          Colors.white.withOpacity((.22 + twinkle * .62) * star.depth);
      starPaint.strokeWidth = .6 + star.depth * 1.55;
      if (engine.isOverdrive && engine.phase == GamePhase.playing) {
        canvas.drawLine(
          Offset(x, y - 16 * star.depth),
          Offset(x, y + 7 * star.depth),
          starPaint,
        );
      } else {
        canvas.drawCircle(Offset(x, y), starPaint.strokeWidth, starPaint);
      }
    }

    _paintHorizonGrid(canvas, size);
    _paintVignette(canvas, size);
  }

  void _paintNebula(
    Canvas canvas,
    Offset center,
    double radius,
    Color color,
  ) {
    final rect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = RadialGradient(
          colors: <Color>[
            color.withOpacity(.13),
            color.withOpacity(.045),
            Colors.transparent,
          ],
        ).createShader(rect),
    );
  }

  void _paintHorizonGrid(Canvas canvas, Size size) {
    final horizon = size.height * .57;
    final gridPaint = Paint()
      ..color = _blue.withOpacity(.085)
      ..strokeWidth = 1;

    for (var i = 0; i <= 10; i++) {
      final t = i / 10;
      final x = size.width * t;
      final bottomX = size.width / 2 + (x - size.width / 2) * 1.9;
      canvas.drawLine(
        Offset(size.width / 2 + (x - size.width / 2) * .08, horizon),
        Offset(bottomX, size.height),
        gridPaint,
      );
    }
    for (var i = 0; i < 9; i++) {
      final t = i / 8;
      final eased = t * t;
      final y = horizon + eased * (size.height - horizon);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
  }

  void _paintVignette(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = RadialGradient(
          radius: .78,
          colors: <Color>[
            Colors.transparent,
            _ink.withOpacity(.08),
            Colors.black.withOpacity(.62),
          ],
          stops: const <double>[.45, .76, 1],
        ).createShader(Offset.zero & size),
    );
  }

  void _paintMeteors(Canvas canvas) {
    for (final meteor in engine.meteors) {
      canvas.save();
      canvas.translate(meteor.position.dx, meteor.position.dy);
      canvas.rotate(meteor.rotation);

      final trailPath = Path()
        ..moveTo(-meteor.radius * .42, -meteor.radius * .45)
        ..lineTo(-meteor.radius * .18, -meteor.radius * 2.8)
        ..lineTo(meteor.radius * .42, -meteor.radius * .5)
        ..close();
      canvas.drawPath(
        trailPath,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: <Color>[
              _pink.withOpacity(.42),
              _purple.withOpacity(.08),
              Colors.transparent,
            ],
          ).createShader(Rect.fromLTRB(
            -meteor.radius,
            -meteor.radius * 3,
            meteor.radius,
            meteor.radius,
          )),
      );

      final glow = Paint()
        ..color = _pink.withOpacity(.22)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 15);
      canvas.drawCircle(Offset.zero, meteor.radius * 1.05, glow);

      final shape = _meteorPath(meteor.radius, meteor.variant);
      canvas.drawPath(
        shape,
        Paint()
          ..shader = const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: <Color>[
              Color(0xFFFF8FB7),
              Color(0xFF8D3E89),
              Color(0xFF321E56),
            ],
          ).createShader(Rect.fromCircle(
            center: Offset.zero,
            radius: meteor.radius,
          )),
      );
      canvas.drawPath(
        shape,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4
          ..color = const Color(0xFFFFB2D0).withOpacity(.75),
      );

      final craterPaint = Paint()
        ..color = const Color(0xFF321E56).withOpacity(.7);
      canvas.drawCircle(
        Offset(-meteor.radius * .25, -meteor.radius * .18),
        meteor.radius * .18,
        craterPaint,
      );
      canvas.drawCircle(
        Offset(meteor.radius * .28, meteor.radius * .25),
        meteor.radius * .12,
        craterPaint,
      );
      canvas.restore();
    }
  }

  Path _meteorPath(double r, int variant) {
    final points = variant == 0 ? 9 : (variant == 1 ? 8 : 10);
    final path = Path();
    for (var i = 0; i < points; i++) {
      final angle = math.pi * 2 * i / points;
      final wobble = .82 + ((i * 37 + variant * 11) % 19) / 100;
      final point = Offset.fromDirection(angle, r * wobble);
      if (i == 0) {
        path.moveTo(point.dx, point.dy);
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    return path..close();
  }

  void _paintOrbs(Canvas canvas) {
    for (final orb in engine.orbs) {
      final pulse = 1 + math.sin(engine.pulse * 6 + orb.phase) * .12;
      final center = orb.position;
      canvas.drawCircle(
        center,
        22 * pulse,
        Paint()
          ..color = _cyan.withOpacity(.2)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 13),
      );
      canvas.drawCircle(
        center,
        10 * pulse,
        Paint()
          ..shader = const RadialGradient(
            colors: <Color>[Colors.white, _cyan, Color(0xFF159A9C)],
          ).createShader(Rect.fromCircle(center: center, radius: 11)),
      );
      final ringPaint = Paint()
        ..color = _cyan.withOpacity(.68)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4;
      canvas.drawCircle(center, 16 * pulse, ringPaint);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: 20 * pulse),
        engine.pulse * 2,
        math.pi * .75,
        false,
        ringPaint,
      );
    }
  }

  void _paintSparks(Canvas canvas) {
    for (final spark in engine.sparks) {
      final progress = (spark.life / spark.maxLife).clamp(0.0, 1.0);
      final paint = Paint()
        ..color = spark.color.withOpacity(progress)
        ..strokeCap = StrokeCap.round
        ..strokeWidth = spark.size * progress;
      final tail = spark.velocity * -.025;
      canvas.drawLine(spark.position, spark.position + tail, paint);
    }
  }

  void _paintShip(Canvas canvas) {
    if (engine.isInvulnerable &&
        !engine.isOverdrive &&
        (engine.pulse * 12).floor().isEven) {
      return;
    }

    canvas.save();
    canvas.translate(engine.player.dx, engine.player.dy);
    final lean = ((engine.target.dx - engine.player.dx) / 85).clamp(-.24, .24);
    canvas.rotate(lean);

    final activeColor = engine.isOverdrive ? _purple : _cyan;
    canvas.drawCircle(
      Offset.zero,
      engine.isOverdrive ? 36 : 27,
      Paint()
        ..color = activeColor.withOpacity(engine.isOverdrive ? .30 : .17)
        ..maskFilter =
            MaskFilter.blur(BlurStyle.normal, engine.isOverdrive ? 21 : 13),
    );

    if (engine.isOverdrive) {
      final shieldPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..shader = SweepGradient(
          transform: GradientRotation(engine.pulse * 2.1),
          colors: const <Color>[_purple, _cyan, _blue, _purple],
        ).createShader(const Rect.fromLTWH(-36, -36, 72, 72));
      canvas.drawCircle(Offset.zero, 32, shieldPaint);
    }

    final ship = Path()
      ..moveTo(0, -25)
      ..cubicTo(7, -17, 17, 1, 20, 19)
      ..lineTo(7, 14)
      ..lineTo(0, 21)
      ..lineTo(-7, 14)
      ..lineTo(-20, 19)
      ..cubicTo(-17, 1, -7, -17, 0, -25)
      ..close();
    canvas.drawPath(
      ship,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[
            Color(0xFFF5FAFF),
            Color(0xFF8AA5FF),
            Color(0xFF29356E),
          ],
        ).createShader(const Rect.fromLTWH(-22, -26, 44, 50)),
    );
    canvas.drawPath(
      ship,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.3
        ..color = Colors.white.withOpacity(.85),
    );

    final canopy = Path()
      ..moveTo(0, -16)
      ..cubicTo(6, -8, 7, 3, 0, 8)
      ..cubicTo(-7, 3, -6, -8, 0, -16)
      ..close();
    canvas.drawPath(
      canopy,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[Colors.white, _cyan, _blue],
        ).createShader(const Rect.fromLTWH(-8, -17, 16, 26)),
    );

    final light = Paint()..color = activeColor;
    canvas.drawCircle(const Offset(-12, 12), 2.2, light);
    canvas.drawCircle(const Offset(12, 12), 2.2, light);

    final flameLength = 12 + math.sin(engine.pulse * 28) * 4;
    final flame = Path()
      ..moveTo(-6, 17)
      ..quadraticBezierTo(0, 20 + flameLength, 6, 17)
      ..quadraticBezierTo(0, 24, -6, 17)
      ..close();
    canvas.drawPath(
      flame,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[Colors.white, activeColor, Colors.transparent],
        ).createShader(Rect.fromLTWH(-8, 16, 16, flameLength + 9)),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant NeonDriftPainter oldDelegate) => true;
}
