export type OrderStatus = 'pending' | 'assigned' | 'delivered';

export interface Order {
  order_id?: number;
  customer_id: number;
  order_date: string;
  box_quantity: number; // 1-3 กล่อง ตามโจทย์
  box_count?: number;    // เข้ากันได้กับโค้ดเดิม
  delivery_lat: number;
  delivery_lng: number;
  order_status: OrderStatus;
  stop_sequence?: number; // ลำดับจุดส่ง เช่น 1, 2, 3
  job_id?: number | null;

  // ฟิลด์ช่วยเหลือสำหรับแสดงผลใน Frontend
  customer_name?: string;
  customer_phone?: string;
  distance_from_prev?: number;
}
