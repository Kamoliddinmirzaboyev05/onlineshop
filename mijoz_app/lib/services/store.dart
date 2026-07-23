import 'package:flutter/material.dart';
import '../models/catalog.dart';
import 'api.dart';

class StoreProvider extends ChangeNotifier {
  RestaurantDetail? store;
  bool loading = true;
  bool error = false;
  bool outOfRange = false;
  bool needsLocation = false;

  StoreProvider() {
    load();
  }

  Future<void> load() async {
    loading = true;
    error = false;
    outOfRange = false;
    needsLocation = false;
    notifyListeners();

    try {
      // TODO: implement real location checking for the client app.
      // For now, default coordinates to Tashkent for demo
      final lat = 41.2995;
      final lng = 69.2401;
      final res = await api.get('/restaurants/nearest?lat=$lat&lng=$lng');
      store = RestaurantDetail.fromJson(res);
    } catch (e) {
      if (e.toString().contains('OUT_OF_RANGE')) {
        outOfRange = true;
      } else {
        error = true;
      }
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}
