import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/cart.dart';
import '../services/api.dart';
import '../core/theme.dart';
import 'home_page.dart';

class CheckoutPage extends StatefulWidget {
  const CheckoutPage({super.key});

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  final _addressController = TextEditingController();
  final _commentController = TextEditingController();
  bool _loading = false;

  void _placeOrder() async {
    final address = _addressController.text.trim();
    if (address.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Manzilni kiriting')));
      return;
    }

    setState(() => _loading = true);
    try {
      final cart = context.read<CartProvider>();
      final payload = {
        'restaurant_id': 1, // Just hardcoded for now, would be from store provider
        'address_line': address,
        'comment': _commentController.text,
        'payment_method': 'cash',
        'lat': 41.2995,
        'lng': 69.2401,
        'items': cart.items.map((i) => i.toJson()).toList(),
      };
      await api.post('/orders', payload);
      cart.clear();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomePage()),
          (r) => false,
        );
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Buyurtma qabul qilindi')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Xatolik: $e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      appBar: AppBar(
        title: const Text('Rasmiylashtirish', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _addressController,
              decoration: const InputDecoration(
                labelText: 'Manzil (majburiy)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _commentController,
              decoration: const InputDecoration(
                labelText: 'Kuryer uchun izoh (ixtiyoriy)',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _loading ? null : _placeOrder,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brand,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _loading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Buyurtma berish', style: TextStyle(fontSize: 18, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}
