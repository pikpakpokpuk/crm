export type JobStatus =
  | 'new'
  | 'in_progress'
  | 'waiting_parts'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  vin?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  active: boolean;
}

export interface Job {
  id: string;
  created_at: string;
  created_by: string;
  customer_id: string;
  vehicle_id?: string;
  assigned_to?: string;
  description: string;
  damage_type?: string;
  priority: Priority;
  estimated_price?: number;
  final_price?: number;
  status: JobStatus;
  customer?: Customer;
  vehicle?: Vehicle;
  employee?: Employee;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  category?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
}
