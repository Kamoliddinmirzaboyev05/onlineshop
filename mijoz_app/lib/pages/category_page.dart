import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/catalog.dart';
import '../core/theme.dart';
import '../services/cart.dart';
import 'cart_page.dart';

class CategoryPage extends StatelessWidget {
  const CategoryPage({super.key, required this.category});

  final Category category;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      appBar: AppBar(
        title: Text(category.nameUz, style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black,
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: category.subcategories.length,
        itemBuilder: (context, index) {
          final sub = category.subcategories[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sub.nameUz,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                ),
                const SizedBox(height: 12),
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: sub.products.length,
                  itemBuilder: (context, pIndex) {
                    final p = sub.products[pIndex];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          if (p.imageUrl != null) ...[
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(
                                p.imageUrl!,
                                width: 80,
                                height: 80,
                                fit: BoxFit.cover,
                              ),
                            ),
                            const SizedBox(width: 12),
                          ],
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  p.nameUz,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                ),
                                if (p.descriptionUz != null)
                                  Text(
                                    p.descriptionUz!,
                                    style: const TextStyle(color: Colors.black54, fontSize: 13),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      '${p.price} so\'m${p.unit != null ? ' / ${p.unit}' : ''}',
                                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand),
                                    ),
                                    Consumer<CartProvider>(
                                      builder: (context, cart, _) {
                                        final q = cart.quantityOf(p.id);
                                        if (q > 0) {
                                          return Row(
                                            children: [
                                              IconButton(
                                                icon: const Icon(Icons.remove_circle_outline, color: AppColors.brand),
                                                onPressed: () => cart.remove(p.id),
                                                padding: EdgeInsets.zero,
                                                constraints: const BoxConstraints(),
                                              ),
                                              const SizedBox(width: 8),
                                              Text('$q', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                                              const SizedBox(width: 8),
                                              IconButton(
                                                icon: const Icon(Icons.add_circle_outline, color: AppColors.brand),
                                                onPressed: () => cart.add(p),
                                                padding: EdgeInsets.zero,
                                                constraints: const BoxConstraints(),
                                              ),
                                            ],
                                          );
                                        }
                                        return ElevatedButton(
                                          onPressed: () => cart.add(p),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: AppColors.brand,
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                                            minimumSize: const Size(0, 32),
                                          ),
                                          child: const Text('Qo\'shish', style: TextStyle(color: Colors.white)),
                                        );
                                      }
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: Consumer<CartProvider>(
        builder: (context, cart, _) {
          if (cart.totalItems == 0) return const SizedBox.shrink();
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: ElevatedButton(
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const CartPage()));
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.brand,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${cart.totalItems} ta', style: const TextStyle(fontSize: 16, color: Colors.white)),
                    const Text('Savatchaga', style: TextStyle(fontSize: 18, color: Colors.white)),
                    Text('${cart.totalPrice} so\'m', style: const TextStyle(fontSize: 16, color: Colors.white)),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
