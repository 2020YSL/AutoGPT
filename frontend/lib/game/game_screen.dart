// ignore_for_file: deprecated_member_use

import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'game_engine.dart';
import 'game_painter.dart';

const Color _cyan = Color(0xFF42F5D7);
const Color _blue = Color(0xFF5E7BFF);
const Color _purple = Color(0xFFB36BFF);
const Color _pink = Color(0xFFFF4D8D);

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen>
    with SingleTickerProviderStateMixin {
  static const String _bestScoreKey = 'neon_drift_best_score';

  final NeonDriftEngine _engine = NeonDriftEngine();
  late final Ticker _ticker;
  Duration? _previousElapsed;

  @override
  void initState() {
    super.initState();
    _loadBestScore();
    _ticker = createTicker(_onTick)..start();
  }

  Future<void> _loadBestScore() async {
    final preferences = await SharedPreferences.getInstance();
    _engine.setBestScore(preferences.getInt(_bestScoreKey) ?? 0);
    if (mounted) setState(() {});
  }

  void _onTick(Duration elapsed) {
    final previous = _previousElapsed;
    _previousElapsed = elapsed;
    if (previous == null || !mounted) return;
    final dt =
        ((elapsed - previous).inMicroseconds / Duration.microsecondsPerSecond)
            .clamp(0.0, .05);
    _engine.update(dt);
    if (_engine.gameOverJustTriggered) {
      HapticFeedback.heavyImpact();
      _saveBestScore();
    }
    setState(() {});
  }

  Future<void> _saveBestScore() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setInt(_bestScoreKey, _engine.bestScore);
  }

  void _startGame() {
    HapticFeedback.mediumImpact();
    _engine.start();
    setState(() {});
  }

  void _togglePause() {
    HapticFeedback.selectionClick();
    _engine.togglePause();
    setState(() {});
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050714),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final size = Size(constraints.maxWidth, constraints.maxHeight);
          _engine.resize(size);
          return Stack(
            fit: StackFit.expand,
            children: <Widget>[
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onPanDown: (details) =>
                    _engine.moveTarget(details.localPosition),
                onPanUpdate: (details) =>
                    _engine.moveTarget(details.localPosition),
                child: RepaintBoundary(
                  child: CustomPaint(
                    painter: NeonDriftPainter(_engine),
                    size: size,
                  ),
                ),
              ),
              if (_engine.phase == GamePhase.playing) _buildHud(),
              if (_engine.phase == GamePhase.menu) _buildMenu(),
              if (_engine.phase == GamePhase.paused) _buildPause(),
              if (_engine.phase == GamePhase.gameOver) _buildGameOver(),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHud() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 20),
        child: Column(
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const _MicroLabel('SCORE'),
                      const SizedBox(height: 2),
                      Text(
                        _engine.roundedScore.toString().padLeft(6, '0'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 27,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 2.5,
                          height: 1,
                        ),
                      ),
                    ],
                  ),
                ),
                _IntegrityDisplay(value: _engine.integrity),
                const SizedBox(width: 12),
                _RoundIconButton(
                  icon: Icons.pause_rounded,
                  label: '暫停',
                  onPressed: _togglePause,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: <Widget>[
                Expanded(
                  child: _ChargeBar(
                    value: _engine.isOverdrive
                        ? _engine.overdrive / 5.5
                        : _engine.charge / 100,
                    overdrive: _engine.isOverdrive,
                  ),
                ),
                if (_engine.combo > 1) ...<Widget>[
                  const SizedBox(width: 12),
                  _ComboBadge(combo: _engine.combo),
                ],
              ],
            ),
            const Spacer(),
            AnimatedOpacity(
              opacity: _engine.elapsed < 3.8 ? 1 : 0,
              duration: const Duration(milliseconds: 500),
              child: IgnorePointer(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                  decoration: BoxDecoration(
                    color: const Color(0xFF090D22).withOpacity(.68),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(color: Colors.white.withOpacity(.1)),
                  ),
                  child: const Text(
                    '按住並拖動飛船',
                    style: TextStyle(
                      color: Color(0xCCFFFFFF),
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenu() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 25),
        child: Column(
          children: <Widget>[
            const Spacer(flex: 3),
            const _LogoMark(),
            const SizedBox(height: 22),
            ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: <Color>[Colors.white, Color(0xFFC9D7FF), _cyan],
              ).createShader(bounds),
              child: const Text(
                'NEON\nDRIFT',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 53,
                  height: .86,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 7,
                ),
              ),
            ),
            const SizedBox(height: 17),
            const Text(
              '穿越星潮 · 點亮宇宙',
              style: TextStyle(
                color: Color(0xFFAEBBE4),
                fontSize: 14,
                fontWeight: FontWeight.w600,
                letterSpacing: 3.5,
              ),
            ),
            const Spacer(flex: 2),
            _GlassPanel(
              child: Column(
                children: <Widget>[
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: <Widget>[
                      _Feature(
                        icon: Icons.swipe_rounded,
                        title: '拖動',
                        subtitle: '自由閃避',
                      ),
                      _Feature(
                        icon: Icons.bolt_rounded,
                        title: '蓄能',
                        subtitle: '啟動超載',
                      ),
                      _Feature(
                        icon: Icons.auto_awesome_rounded,
                        title: '連擊',
                        subtitle: '突破高分',
                      ),
                    ],
                  ),
                  const SizedBox(height: 23),
                  _PrimaryButton(
                    label: '開始航行',
                    icon: Icons.play_arrow_rounded,
                    onPressed: _startGame,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              _engine.bestScore > 0
                  ? '最高紀錄  ${_engine.bestScore.toString().padLeft(6, '0')}'
                  : '收集能量核心，避開星際碎片',
              style: TextStyle(
                color: Colors.white.withOpacity(.55),
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.4,
              ),
            ),
            const Spacer(),
          ],
        ),
      ),
    );
  }

  Widget _buildPause() {
    return _CenteredOverlay(
      child: _GlassPanel(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(Icons.pause_rounded, color: _cyan, size: 34),
            const SizedBox(height: 10),
            const Text(
              '航行暫停',
              style: TextStyle(
                color: Colors.white,
                fontSize: 25,
                fontWeight: FontWeight.w800,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              '深呼吸，星海會等你。',
              style: TextStyle(color: Color(0xFFAEBBE4)),
            ),
            const SizedBox(height: 25),
            _PrimaryButton(
              label: '繼續航行',
              icon: Icons.play_arrow_rounded,
              onPressed: _togglePause,
            ),
            const SizedBox(height: 10),
            _SecondaryButton(
              label: '返回主頁',
              onPressed: () {
                _engine.returnToMenu();
                setState(() {});
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGameOver() {
    final isRecord =
        _engine.roundedScore >= _engine.bestScore && _engine.roundedScore > 0;
    return _CenteredOverlay(
      child: _GlassPanel(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _pink.withOpacity(.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _pink.withOpacity(.28)),
              ),
              child: Text(
                isRecord ? '✦  新紀錄' : '本次航行',
                style: const TextStyle(
                  color: Color(0xFFFF91B9),
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.5,
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              _engine.roundedScore.toString().padLeft(6, '0'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 46,
                height: 1,
                fontWeight: FontWeight.w900,
                letterSpacing: 4,
              ),
            ),
            const SizedBox(height: 8),
            const _MicroLabel('FINAL SCORE'),
            const SizedBox(height: 24),
            Row(
              children: <Widget>[
                Expanded(
                  child: _ResultStat(
                    label: '生存時間',
                    value: '${_engine.elapsed.floor()} 秒',
                  ),
                ),
                Container(
                  width: 1,
                  height: 38,
                  color: Colors.white.withOpacity(.1),
                ),
                Expanded(
                  child: _ResultStat(
                    label: '最高紀錄',
                    value: _engine.bestScore.toString(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 26),
            _PrimaryButton(
              label: '再次挑戰',
              icon: Icons.replay_rounded,
              onPressed: _startGame,
            ),
            const SizedBox(height: 10),
            _SecondaryButton(
              label: '返回主頁',
              onPressed: () {
                _engine.returnToMenu();
                setState(() {});
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CenteredOverlay extends StatelessWidget {
  const _CenteredOverlay({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF030510).withOpacity(.58),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 25),
      child: child,
    );
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: const Color(0xFF111735).withOpacity(.64),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withOpacity(.12)),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: _blue.withOpacity(.1),
                blurRadius: 30,
                spreadRadius: -8,
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(17),
          gradient: const LinearGradient(colors: <Color>[_blue, _purple]),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: _purple.withOpacity(.34),
              blurRadius: 22,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(17),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Icon(icon, color: Colors.white),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SecondaryButton extends StatelessWidget {
  const _SecondaryButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          foregroundColor: const Color(0xFFB7C2E6),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
            side: BorderSide(color: Colors.white.withOpacity(.1)),
          ),
        ),
        child: Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: 1),
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: const Color(0xFF111735).withOpacity(.72),
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          child: Container(
            width: 43,
            height: 43,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withOpacity(.12)),
            ),
            child: Icon(icon, color: Colors.white, size: 21),
          ),
        ),
      ),
    );
  }
}

class _MicroLabel extends StatelessWidget {
  const _MicroLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: Color(0xFF8290BD),
        fontSize: 9,
        fontWeight: FontWeight.w800,
        letterSpacing: 2,
      ),
    );
  }
}

class _IntegrityDisplay extends StatelessWidget {
  const _IntegrityDisplay({required this.value});

  final int value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        children: List<Widget>.generate(3, (index) {
          final active = index < value;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Icon(
              Icons.favorite_rounded,
              size: 17,
              color: active ? _pink : Colors.white.withOpacity(.16),
              shadows: active
                  ? const <Shadow>[
                      Shadow(color: _pink, blurRadius: 10),
                    ]
                  : null,
            ),
          );
        }),
      ),
    );
  }
}

class _ChargeBar extends StatelessWidget {
  const _ChargeBar({required this.value, required this.overdrive});

  final double value;
  final bool overdrive;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Icon(
              overdrive ? Icons.flash_on_rounded : Icons.bolt_rounded,
              color: overdrive ? _purple : _cyan,
              size: 14,
            ),
            const SizedBox(width: 4),
            Text(
              overdrive ? '超載模式' : '能量充能',
              style: TextStyle(
                color: overdrive ? _purple : const Color(0xFFAEBBE4),
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.4,
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(5),
          child: Container(
            height: 6,
            color: Colors.white.withOpacity(.1),
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: value.clamp(0.0, 1.0),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: overdrive
                        ? const <Color>[_purple, _pink]
                        : const <Color>[_blue, _cyan],
                  ),
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: overdrive ? _purple : _cyan,
                      blurRadius: 8,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ComboBadge extends StatelessWidget {
  const _ComboBadge({required this.combo});

  final int combo;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: <Color>[_purple.withOpacity(.28), _pink.withOpacity(.2)],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _purple.withOpacity(.4)),
      ),
      child: Text(
        '×$combo 連擊',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _LogoMark extends StatelessWidget {
  const _LogoMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 67,
      height: 67,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[_cyan, _blue, _purple],
        ),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: _cyan.withOpacity(.32),
            blurRadius: 30,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Container(
        margin: const EdgeInsets.all(3),
        decoration: const BoxDecoration(
          color: Color(0xFF0B1027),
          shape: BoxShape.circle,
        ),
        child:
            const Icon(Icons.navigation_rounded, color: Colors.white, size: 32),
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: _blue.withOpacity(.11),
            borderRadius: BorderRadius.circular(13),
            border: Border.all(color: _blue.withOpacity(.22)),
          ),
          child: Icon(icon, color: _cyan, size: 20),
        ),
        const SizedBox(height: 8),
        Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: const TextStyle(color: Color(0xFF7785AD), fontSize: 9),
        ),
      ],
    );
  }
}

class _ResultStat extends StatelessWidget {
  const _ResultStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF8290BD),
            fontSize: 10,
            letterSpacing: 1,
          ),
        ),
      ],
    );
  }
}
