import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/stats.dart';
import '../services/api.dart';
import '../services/cache.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';

/// Mirrors `pages/EarningsPage.tsx`.
class EarningsPage extends StatefulWidget {
  const EarningsPage({super.key});

  @override
  State<EarningsPage> createState() => _EarningsPageState();
}

class _EarningsPageState extends State<EarningsPage> {
  static const _ranges = [(7, '7 kun'), (30, '30 kun'), (90, '90 kun')];

  int _days = 7;
  final Map<int, Resource<EarningsOut>> _cache = {};

  Resource<EarningsOut> _resFor(int days) {
    return _cache.putIfAbsent(
      days,
      () => Resource<EarningsOut>(
        cacheKey: 'courier_earnings_$days',
        fetchRaw: () => api.get('/courier/earnings?days=$days'),
        parse: EarningsOut.fromJson,
        errorText: "Daromadni yuklab bo'lmadi. Internetni tekshiring.",
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _resFor(_days);
  }

  @override
  void dispose() {
    for (final r in _cache.values) {
      r.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final res = _resFor(_days);
    return AnimatedBuilder(
      animation: res,
      builder: (context, _) {
        final data = res.data;
        final recent = [...(data?.series ?? <EarningsDay>[])]
            .reversed
            .where((d) => d.delivered > 0)
            .toList();
        return Column(
          children: [
            PageHeader(
              title: 'Daromad',
              loading: res.loading || res.refreshing,
              onRefresh: res.refresh,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  for (final r in _ranges) ...[
                    _RangeChip(
                      label: r.$2,
                      active: _days == r.$1,
                      onTap: () => setState(() => _days = r.$1),
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
            Expanded(
              child: res.loading
                  ? const EarningsSkeleton()
                  : RefreshIndicator(
                      color: AppColors.brand,
                      onRefresh: () async => res.refresh(),
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          if (res.error != null) ...[
                            ErrorBanner(res.error!),
                            const SizedBox(height: 16),
                          ],
                          // Total card
                          AppCard(
                            color: AppColors.brand,
                            border: Border.all(color: Colors.transparent),
                            padding: const EdgeInsets.all(20),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Jami daromad',
                                    style: TextStyle(
                                        fontSize: 14,
                                        color: Colors.white.withValues(alpha: 0.9))),
                                const SizedBox(height: 4),
                                Text("${money(data?.totalEarnings ?? 0)} so'm",
                                    style: const TextStyle(
                                        fontSize: 30,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white)),
                                const SizedBox(height: 4),
                                Text('${data?.totalDelivered ?? 0} ta buyurtma yetkazildi',
                                    style: TextStyle(
                                        fontSize: 14,
                                        color: Colors.white.withValues(alpha: 0.9))),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          // Daily list
                          AppCard(
                            padding: EdgeInsets.zero,
                            child: recent.isEmpty
                                ? const Padding(
                                    padding: EdgeInsets.all(32),
                                    child: Center(
                                      child: Text('Bu davrda daromad yo\'q',
                                          style: TextStyle(
                                              fontSize: 14, color: AppColors.slate400)),
                                    ),
                                  )
                                : Column(
                                    children: [
                                      for (var i = 0; i < recent.length; i++)
                                        _DayRow(day: recent[i], top: i > 0),
                                    ],
                                  ),
                          ),
                        ],
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _RangeChip extends StatelessWidget {
  const _RangeChip({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      borderRadius: 999,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.brand : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: active ? null : Border.all(color: AppColors.slate200),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : AppColors.slate500,
          ),
        ),
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({required this.day, required this.top});
  final EarningsDay day;
  final bool top;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border(
          top: top ? const BorderSide(color: AppColors.slate100) : BorderSide.none,
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(formatDay(day.date),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
              const SizedBox(height: 2),
              Text('${day.delivered} ta yetkazildi',
                  style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
            ],
          ),
          Text("${money(day.earnings)} so'm",
              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand)),
        ],
      ),
    );
  }
}
