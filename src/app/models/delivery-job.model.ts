import { Order } from './order.model';

export interface DeliveryJob {
  job_id: number;
  rider_name: string;
  route_color: string;         // สีเส้นทาง เช่น '#EF4444', '#10B981', '#3B82F6'
  total_boxes: number;         // ผลรวมกล่องข้าว (ไม่เกิน 10 กล่อง)
  total_distance: number;      // ระยะทางรวมทั้งรอบ (กม.)
  total_cost: number;          // ค่าจ้างส่งไรเดอร์ (15 บาท + 2 บาท/กม./กล่อง)
  estimated_time: number;      // เวลาที่คาดว่าจะใช้จัดส่ง (นาที)
  orders: Order[];             // ออเดอร์ในรอบนี้ (ไม่เกินคนละ 3 ออเดอร์)

  // ข้อมูลวิเคราะห์กำไร/ขาดทุน และสถานะการจัดส่ง
  revenue?: number;            // ยอดขาย = total_boxes * 65
  food_cost?: number;          // ต้นทุนอาหาร = total_boxes * 40
  net_profit?: number;         // กำไรสุทธิ = revenue - food_cost - total_cost
  is_delayed?: boolean;        // เกิน 60 นาทีหรือไม่ (เสี่ยงส่งไม่ทัน 12:30 น.)
  status?: 'assigned' | 'in_transit' | 'completed';
}

