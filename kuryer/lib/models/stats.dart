/// Stats + earnings models mirroring `src/types.ts`.
library;

class StatBucket {
  StatBucket({required this.delivered, required this.earnings, required this.cancelled});

  final int delivered;
  final num earnings;
  final int cancelled;

  factory StatBucket.fromJson(Map<String, dynamic> j) => StatBucket(
        delivered: (j['delivered'] ?? 0) as int,
        earnings: (j['earnings'] ?? 0) as num,
        cancelled: (j['cancelled'] ?? 0) as int,
      );
}

class DaySeries {
  DaySeries({required this.date, required this.delivered, required this.earnings});

  final String date;
  final int delivered;
  final num earnings;

  factory DaySeries.fromJson(Map<String, dynamic> j) => DaySeries(
        date: (j['date'] ?? '') as String,
        delivered: (j['delivered'] ?? 0) as int,
        earnings: (j['earnings'] ?? 0) as num,
      );
}

class CourierStats {
  CourierStats({
    required this.today,
    required this.week,
    required this.month,
    required this.active,
    required this.series,
  });

  final StatBucket today;
  final StatBucket week;
  final StatBucket month;
  final int active;
  final List<DaySeries> series;

  factory CourierStats.fromJson(dynamic json) {
    final j = json as Map<String, dynamic>;
    return CourierStats(
      today: StatBucket.fromJson((j['today'] ?? {}) as Map<String, dynamic>),
      week: StatBucket.fromJson((j['week'] ?? {}) as Map<String, dynamic>),
      month: StatBucket.fromJson((j['month'] ?? {}) as Map<String, dynamic>),
      active: (j['active'] ?? 0) as int,
      series: ((j['series'] ?? []) as List)
          .map((e) => DaySeries.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class EarningsDay {
  EarningsDay({required this.date, required this.delivered, required this.earnings});

  final String date;
  final int delivered;
  final num earnings;

  factory EarningsDay.fromJson(Map<String, dynamic> j) => EarningsDay(
        date: (j['date'] ?? '') as String,
        delivered: (j['delivered'] ?? 0) as int,
        earnings: (j['earnings'] ?? 0) as num,
      );
}

class EarningsOut {
  EarningsOut({
    required this.days,
    required this.totalDelivered,
    required this.totalEarnings,
    required this.series,
  });

  final int days;
  final int totalDelivered;
  final num totalEarnings;
  final List<EarningsDay> series;

  factory EarningsOut.fromJson(dynamic json) {
    final j = json as Map<String, dynamic>;
    return EarningsOut(
      days: (j['days'] ?? 0) as int,
      totalDelivered: (j['total_delivered'] ?? 0) as int,
      totalEarnings: (j['total_earnings'] ?? 0) as num,
      series: ((j['series'] ?? []) as List)
          .map((e) => EarningsDay.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
