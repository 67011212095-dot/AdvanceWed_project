export interface Order {
  order_id?: number;
  customer_id: number;
  order_date: string;
  delivery_lat: number;
  delivery_lng: number;
}