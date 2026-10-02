export interface Order {
  order_id?: number;
  customer_id: number;
  order_date: string;
  box_count: number;
  delivery_lat: number;
  delivery_lng: number;
}