import 'package:flutter/material.dart';

import 'theme.dart';

/// Mirrors `src/lib/format.ts` from the courier web app.

/// "123 456" — thousands separated by a space (ru-RU style).
String money(num n) {
  final s = n.round().abs().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
    buf.write(s[i]);
  }
  return (n < 0 ? '-' : '') + buf.toString();
}

String _two(int n) => n.toString().padLeft(2, '0');

/// "05.07 14:30"
String formatDateTime(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return iso;
  return '${_two(d.day)}.${_two(d.month)} ${_two(d.hour)}:${_two(d.minute)}';
}

const _monthsShort = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

/// "05 июл"
String formatDay(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return iso;
  return '${_two(d.day)} ${_monthsShort[d.month - 1]}';
}

/// Full timestamp used on the detail screen: "05.07.2026, 14:30:05"
String formatFull(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return iso;
  return '${_two(d.day)}.${_two(d.month)}.${d.year}, '
      '${_two(d.hour)}:${_two(d.minute)}:${_two(d.second)}';
}

const statusLabelMap = {
  'pending': 'Yangi',
  'confirmed': 'Tasdiqlangan',
  'preparing': 'Tayyorlanmoqda',
  'ready': 'Tayyor',
  'accepted': 'Qabul qilindi',
  'delivering': 'Yetkazilmoqda',
  'delivered': 'Yetkazildi',
  'cancelled': 'Bekor qilindi',
};

String statusLabel(String s) => statusLabelMap[s] ?? s;

/// (background, foreground) colours for a status pill.
(Color, Color) statusPillColors(String s) {
  switch (s) {
    case 'confirmed':
      return (const Color(0xFFFEF3C7), const Color(0xFFB45309)); // amber
    case 'preparing':
      return (const Color(0xFFFFEDD5), const Color(0xFFC2410C)); // orange
    case 'ready':
      return (const Color(0xFFEDE9FE), const Color(0xFF6D28D9)); // violet
    case 'accepted':
      return (const Color(0xFFCFFAFE), const Color(0xFF0E7490)); // cyan
    case 'delivering':
      return (const Color(0xFFDBEAFE), const Color(0xFF1D4ED8)); // blue
    case 'delivered':
      return (const Color(0xFFD1FAE5), const Color(0xFF047857)); // emerald
    case 'cancelled':
      return (const Color(0xFFFFE4E6), const Color(0xFFBE123C)); // rose
    case 'pending':
    default:
      return (AppColors.slate100, AppColors.slate700);
  }
}

const _paymentLabelMap = {
  'cash': 'Naqd',
  'payme': 'Payme',
  'click': 'Click',
  'uzum': 'Uzum',
};

String paymentLabel(String? m) => m == null ? '—' : (_paymentLabelMap[m] ?? m);

/// Yandex Maps navigation link (when lat/lng present).
String? mapsUrl(double? lat, double? lng) => (lat != null && lng != null)
    ? 'https://yandex.com/maps/?rtext=~$lat,$lng&rtt=auto'
    : null;

/// "1 kg", "3 dona"
String qtyUnit(num quantity, String? unit) {
  final q = quantity == quantity.roundToDouble()
      ? quantity.round().toString()
      : quantity.toString();
  return '$q ${(unit == null || unit.isEmpty) ? 'dona' : unit}';
}

/// "4.2 km" / "850 m"
String? distanceLabel(double? km) {
  if (km == null) return null;
  return km < 1 ? '${(km * 1000).round()} m' : '${km.toStringAsFixed(1)} km';
}

/// "~25 daqiqa"
String? etaLabel(int? minutes) =>
    (minutes != null && minutes > 0) ? '~$minutes daqiqa' : null;
