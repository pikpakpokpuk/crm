import { useState } from 'react';
import type { InventoryItem } from '@/types';

const MOCK_ITEMS: InventoryItem[] = [
  { id: '1', name: 'Engine Oil 5W-30 (1L)', sku: 'OIL-5W30-1L', quantity: 48, unit: 'piece', unit_price: 4.5, category: 'Fluids' },
  { id: '2', name: 'Brake Pads (front)', sku: 'BRK-PAD-F', quantity: 12, unit: 'set', unit_price: 38, category: 'Brakes' },
  { id: '3', name: 'Air Filter - Universal', sku: 'FLT-AIR-U', quantity: 7, unit: 'piece', unit_price: 12, category: 'Filters' },
  { id: '4', name: 'Windshield Washer Fluid', sku: 'FLD-WASH-4L', quantity: 0, unit: 'bottle', unit_price: 2.8, category: 'Fluids' },
  { id: '5', name: 'Spark Plugs (NGK)', sku: 'PLUG-NGK-B', quantity: 3, unit: 'piece', unit_price: 7.5, category: 'Ignition' },
  { id: '6', name: 'Timing Belt Kit', sku: 'BELT-TIM-K', quantity: 2, unit: 'kit', unit_price: 95, category: 'Engine' },
];

const LOW_STOCK_THRESHOLD = 5;

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const categories = [...new Set(MOCK_ITEMS.map((i) => i.category).filter(Boolean))];

  const filtered = MOCK_ITEMS.filter((item) => {
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || item.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const lowStock = MOCK_ITEMS.filter((i) => i.quantity <= LOW_STOCK_THRESHOLD);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
          <p className="text-gray-500 mt-1">{MOCK_ITEMS.length} items</p>
        </div>
        <button className="btn-primary">+ Add Item</button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
          ⚠️ Low stock: {lowStock.map((i) => i.name).join(', ')}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Unit Price</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-5 py-3 font-mono text-gray-500 text-xs">{item.sku ?? '—'}</td>
                  <td className="px-5 py-3">
                    {item.category && (
                      <span className="badge bg-gray-100 text-gray-600">{item.category}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`font-semibold ${item.quantity === 0 ? 'text-red-600' : item.quantity <= LOW_STOCK_THRESHOLD ? 'text-yellow-600' : 'text-gray-900'}`}>
                      {item.quantity} {item.unit}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700">€{item.unit_price.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button className="btn-secondary text-xs px-2 py-1">Edit</button>
                      <button className="btn-secondary text-xs px-2 py-1">Restock</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No items found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
