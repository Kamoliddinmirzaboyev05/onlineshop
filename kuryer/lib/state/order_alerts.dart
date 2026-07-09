import 'package:flutter/foundation.dart';

/// Shared count of available (not-yet-assigned) orders. The nav shell polls in
/// one place; Dashboard reads it to render its banner. Mirrors `useOrderAlerts`.
class OrderAlerts extends ChangeNotifier {
  int _availableCount = 0;
  int get availableCount => _availableCount;

  void setAvailableCount(int n) {
    if (n == _availableCount) return;
    _availableCount = n;
    notifyListeners();
  }
}
