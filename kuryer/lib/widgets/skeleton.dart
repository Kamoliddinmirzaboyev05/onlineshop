import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Shimmering block — Tailwind `.af-skel` shimmer.
class Skeleton extends StatefulWidget {
  const Skeleton({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = 8,
    this.color,
    this.expand = false,
  });

  final double? width;
  final double height;
  final double borderRadius;
  final Color? color;
  final bool expand;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = widget.color ?? const Color(0xFFE9EDF2);
    final block = AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          child: Container(
            width: widget.width,
            height: widget.height,
            color: base,
            child: FractionalTranslation(
              translation: Offset(-1 + _c.value * 2, 0),
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0x00FFFFFF),
                      Color(0x99FFFFFF),
                      Color(0x00FFFFFF),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
    return widget.expand ? SizedBox(width: double.infinity, child: block) : block;
  }
}

Widget _cardSkel(Widget child) => AppCard(child: child);

class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _cardSkel(Row(children: [
          const Skeleton(width: 44, height: 44, borderRadius: 12),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Skeleton(width: 96, height: 12),
              SizedBox(height: 8),
              Skeleton(width: 40, height: 24),
            ],
          ),
        ])),
        const SizedBox(height: 16),
        const Skeleton(width: 64, height: 12),
        const SizedBox(height: 8),
        Row(
          children: List.generate(
            3,
            (i) => Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: i < 2 ? 12 : 0),
                child: _cardSkel(Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Skeleton(width: 16, height: 16, borderRadius: 999),
                    SizedBox(height: 8),
                    Skeleton(width: 48, height: 20),
                    SizedBox(height: 8),
                    Skeleton(width: 56, height: 12),
                  ],
                )),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: List.generate(
            2,
            (i) => Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: i < 1 ? 12 : 0),
                child: _cardSkel(Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Skeleton(width: 64, height: 12),
                    SizedBox(height: 8),
                    Skeleton(width: 96, height: 24),
                    SizedBox(height: 6),
                    Skeleton(width: 80, height: 12),
                  ],
                )),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        _cardSkel(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Skeleton(width: 96, height: 12),
            const SizedBox(height: 12),
            SizedBox(
              height: 112,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: List.generate(
                  7,
                  (i) => Expanded(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 3),
                      child: Skeleton(height: 40.0 + (i % 4) * 18, borderRadius: 4, expand: true),
                    ),
                  ),
                ),
              ),
            ),
          ],
        )),
      ],
    );
  }
}

class OrderCardSkeleton extends StatelessWidget {
  const OrderCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _cardSkel(Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: const [
            Skeleton(width: 112, height: 24),
            Skeleton(width: 80, height: 20),
          ],
        ),
        const SizedBox(height: 12),
        const Skeleton(height: 16, expand: true),
        const SizedBox(height: 8),
        const Skeleton(width: 180, height: 16),
        const SizedBox(height: 12),
        Row(
          children: List.generate(
            4,
            (i) => const Padding(
              padding: EdgeInsets.only(right: 6),
              child: Skeleton(width: 40, height: 40, borderRadius: 8),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: const [
            Expanded(child: Skeleton(height: 36, borderRadius: 12)),
            SizedBox(width: 8),
            Expanded(child: Skeleton(height: 36, borderRadius: 12)),
          ],
        ),
      ],
    ));
  }
}

class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.count = 4});
  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: count,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => const OrderCardSkeleton(),
    );
  }
}

class HistorySkeleton extends StatelessWidget {
  const HistorySkeleton({super.key, this.count = 5});
  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: count,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => _cardSkel(Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Skeleton(width: 128, height: 20),
              Skeleton(width: 80, height: 20),
            ],
          ),
          const SizedBox(height: 8),
          const Skeleton(width: 200, height: 16),
          const SizedBox(height: 8),
          const Skeleton(width: 96, height: 12),
        ],
      )),
    );
  }
}

class EarningsSkeleton extends StatelessWidget {
  const EarningsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        AppCard(
          color: AppColors.brand.withValues(alpha: 0.9),
          border: Border.all(color: Colors.transparent),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Skeleton(width: 112, height: 16, color: Colors.white.withValues(alpha: 0.3)),
              const SizedBox(height: 8),
              Skeleton(width: 176, height: 32, color: Colors.white.withValues(alpha: 0.3)),
              const SizedBox(height: 8),
              Skeleton(width: 144, height: 16, color: Colors.white.withValues(alpha: 0.3)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: List.generate(
              5,
              (i) => Container(
                decoration: BoxDecoration(
                  border: Border(
                    top: i == 0
                        ? BorderSide.none
                        : const BorderSide(color: AppColors.slate100),
                  ),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Skeleton(width: 80, height: 16),
                        SizedBox(height: 6),
                        Skeleton(width: 96, height: 12),
                      ],
                    ),
                    const Skeleton(width: 96, height: 20),
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

class OrderDetailSkeleton extends StatelessWidget {
  const OrderDetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Skeleton(width: 80, height: 16),
        const SizedBox(height: 16),
        const Skeleton(width: 192, height: 28),
        const SizedBox(height: 8),
        const Skeleton(width: 128, height: 16),
        const SizedBox(height: 16),
        _cardSkel(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Skeleton(height: 16, expand: true),
            SizedBox(height: 10),
            Skeleton(width: 200, height: 16),
            SizedBox(height: 10),
            Skeleton(width: 140, height: 16),
            SizedBox(height: 12),
            Skeleton(height: 40, borderRadius: 12, expand: true),
          ],
        )),
        const SizedBox(height: 12),
        _cardSkel(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Skeleton(width: 112, height: 16),
            const SizedBox(height: 12),
            ...List.generate(
              3,
              (i) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(children: const [
                  Skeleton(width: 48, height: 48, borderRadius: 12),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Skeleton(height: 16, expand: true),
                        SizedBox(height: 6),
                        Skeleton(width: 100, height: 12),
                      ],
                    ),
                  ),
                  SizedBox(width: 12),
                  Skeleton(width: 64, height: 16),
                ]),
              ),
            ),
          ],
        )),
      ],
    );
  }
}
