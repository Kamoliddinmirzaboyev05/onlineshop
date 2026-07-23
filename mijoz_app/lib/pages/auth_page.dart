import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../services/api.dart';
import '../widgets/common.dart';
import '../widgets/toast.dart';
import 'home_page.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  bool _isLogin = true;

  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();

  bool _loading = false;

  void _submit() async {
    final phone = _phoneController.text.trim();
    final password = _passwordController.text;
    final name = _nameController.text.trim();

    if (phone.isEmpty || password.isEmpty || (!_isLogin && name.isEmpty)) {
      toast.error('Barcha maydonlarni to\'ldiring');
      return;
    }

    setState(() => _loading = true);
    try {
      final res = await api.post(
        _isLogin ? '/auth/login' : '/auth/register',
        {
          'phone': phone,
          'password': password,
          if (!_isLogin) 'first_name': name,
        },
      );
      final token = res['token']['access_token'];
      await api.setToken(token);
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomePage()),
        );
      }
    } catch (e) {
      toast.error(
        _isLogin ? 'Telefon yoki parol noto\'g\'ri' : 'Xatolik yuz berdi. Balki bu raqam ro\'yxatdan o\'tgandir?',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: AppCard(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _isLogin ? 'Tizimga kirish' : 'Ro\'yxatdan o\'tish',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppColors.slate900,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  if (!_isLogin) ...[
                    TextField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                        labelText: 'Ismingiz',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Telefon raqam',
                      hintText: '+998901234567',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Parol',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 24),
                  AppButton(
                    label: _isLogin ? 'Kirish' : 'Ro\'yxatdan o\'tish',
                    loading: _loading,
                    onPressed: _submit,
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _isLogin = !_isLogin;
                        _phoneController.clear();
                        _passwordController.clear();
                        _nameController.clear();
                      });
                    },
                    child: Text(
                      _isLogin
                          ? 'Hisobingiz yo\'qmi? Ro\'yxatdan o\'ting'
                          : 'Hisobingiz bormi? Tizimga kiring',
                      style: const TextStyle(color: AppColors.brand),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
