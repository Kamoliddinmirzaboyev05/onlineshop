import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../services/cache.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import 'order_detail_page.dart';

/// Mirrors `pages/HistoryPage.tsx`.
class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  static const _filters = [
    ('all', 'Hammasi'),
    ('delivered', 'Yetkazilgan'),
    ('cancelled', 'Bekor'),
  ];

  String _filter = 'all';
  final Map<String, Resource<List<Order>>> _cache = {};

  Resource<List<Order>> _resFor(String filter) {
    return _cache.putIfAbsent(
      filter,
      () => Resource<List<Order>>(
        cacheKey: 'courier_history_$filter',
        fetchRaw: () => api.get(
            '/courier/history${filter == 'all' ? '' : '?status=$filter'}'),
        parse: Order.listFrom,
        errorText: "Tarixni yuklab bo'lmadi. Internetni tekshiring.",
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _resFor(_filter);
  }

  @override
  void dispose() {
    for (final r in _cache.values) {
      r.dispose();
    }
    super.dispose();
  }

  void _open(int id) => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: id)));

  @override
  Widget build(BuildContext context) {
    final res = _resFor(_filter);
    return AnimatedBuilder(
      animation: res,
      builder: (context, _) {
        final orders = res.data ?? [];
        return Column(
          children: [
            PageHeader(
              title: 'Tarix',
              loading: res.loading || res.refreshing,
              onRefresh: res.refresh,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  for (final f in _filters) ...[
                    _FilterChip(
                      label: f.$2,
                      active: _filter == f.$1,
                      onTap: () => setState(() => _filter = f.$1),
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
            Expanded(
              child: res.loading
                  ? const HistorySkeleton()
                  : RefreshIndicator(
                      color: AppColors.brand,
                      onRefresh: () async => res.refresh(),
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          if (res.error != null) ...[
                            ErrorBanner(res.error!),
                            const SizedBox(height: 12),
                          ],
                          if (orders.isEmpty)
                            const EmptyState(
                              icon: Icons.access_time,
                              message: "Tarix bo'sh",
                            ),
                          ...orders.map((o) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _HistoryCard(order: o, onTap: () => _open(o.id)),
                              )),
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

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.active, required this.onTap});
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

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.order, required this.onTap});
  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    Text('№ ${order.number}',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    StatusPill(order.status),
                  ],
                ),
              ),
              Text("${money(order.total)} so'm",
                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.slate400),
              const SizedBox(width: 6),
              Expanded(
                child: Text(order.addressLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, color: AppColors.slate500)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(formatDateTime(order.createdAt),
              style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
        ],
      ),
    );
  }
}
