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
  email?: string;
  phone: string;
  address?: string;
  taxNumber?: string;
  notes?: string;
  created_at: string;
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
  assigned_to?: string;
  description: string;
  damage_type?: string;
  priority: Priority;
  estimated_price?: number;
  final_price?: number;
  status: JobStatus;
  // vehicle fields inline
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehiclePlate?: string;
  vehicleVin?: string;
  vehicleColor?: string;
  vehicleMileage?: number;
  customer?: Customer;
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
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
}
