import 'package:flutter/foundation.dart';

import '../services/api.dart';
import '../services/cache.dart';

/// Auth store mirroring `src/store.ts` (zustand `useAuth`). Only `courier`
/// accounts are allowed in.
class AuthState extends ChangeNotifier {
  AuthState() {
    // A 401 anywhere (token expired/revoked) clears the token in api.dart; here
    // we drop the in-memory identity so the root AuthGate bounces to /login.
    api.onUnauthorized = () {
      if (username == null && role == null) return;
      username = null;
      role = null;
      clearCache();
      notifyListeners();
    };
  }

  String? username;
  String? role;

  Future<void> login(String username, String password) async {
    final res = await api.post('/admin/auth/login', {
      'username': username,
      'password': password,
    }) as Map<String, dynamic>;
    await api.setToken(res['access_token'] as String);
    try {
      final me = await api.get('/admin/auth/me') as Map<String, dynamic>;
      if (me['role'] != 'courier') {
        await api.setToken(null);
        throw Exception('Faqat kuryer hisobi ruxsat etilgan');
      }
      this.username = me['username'] as String?;
      role = me['role'] as String?;
      notifyListeners();
    } catch (e) {
      // /me failed after token was set — roll back to avoid a half-logged-in state.
      await api.setToken(null);
      this.username = null;
      role = null;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    await api.setToken(null);
    clearCache();
    username = null;
    role = null;
    notifyListeners();
  }

  Future<void> loadMe() async {
    final me = await api.get('/admin/auth/me') as Map<String, dynamic>;
    username = me['username'] as String?;
    role = me['role'] as String?;
    notifyListeners();
  }

  Future<void> changePassword(String oldPassword, String newPassword) async {
    await api.post('/admin/auth/change-password', {
      'old_password': oldPassword,
      'new_password': newPassword,
    });
  }
}
