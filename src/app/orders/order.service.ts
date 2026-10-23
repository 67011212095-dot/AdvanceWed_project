import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { Order } from './order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/orders';
  private localOrders: Order[] = [];

  // Reactive Signal ที่แชร์ข้อมูลออเดอร์ให้ทุก Component เสมอ
  readonly orders = signal<Order[]>([]);

  private syncSignal(): void {
    this.orders.set([...this.localOrders]);
  }

  private normalizeOrder(o: any): Order {
    return {
      ...o,
      box_quantity: o.box_quantity ?? o.box_count ?? 1,
      box_count: o.box_quantity ?? o.box_count ?? 1,
      order_status: o.order_status ?? 'pending',
      stop_sequence: o.stop_sequence ?? null,
      job_id: o.job_id ?? null
    };
  }

  getOrders(): Observable<Order[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map((orders) => {
        const normalized = (orders || []).map((o) => this.normalizeOrder(o));
        this.localOrders = [...normalized];
        this.syncSignal();
        return normalized;
      }),
      catchError(() => {
        this.syncSignal();
        return of(this.localOrders);
      })
    );
  }

  addOrder(order: Order): Observable<Order> {
    const payload = {
      ...order,
      box_count: order.box_quantity || order.box_count || 1,
      box_quantity: order.box_quantity || order.box_count || 1
    };
    return this.http.post<any>(this.apiUrl, payload).pipe(
      map((res) => {
        const normalized = this.normalizeOrder(res);
        this.localOrders.push(normalized);
        this.syncSignal();
        return normalized;
      }),
      catchError(() => {
        const newOrder: Order = {
          ...this.normalizeOrder(payload),
          order_id: this.localOrders.length > 0
            ? Math.max(...this.localOrders.map((o) => o.order_id || 0)) + 1
            : 101
        };
        this.localOrders.push(newOrder);
        this.syncSignal();
        return of(newOrder);
      })
    );
  }

  updateOrder(id: number, order: Order): Observable<Order> {
    const payload = {
      ...order,
      box_count: order.box_quantity || order.box_count || 1,
      box_quantity: order.box_quantity || order.box_count || 1
    };
    return this.http.put<any>(`${this.apiUrl}/${id}`, payload).pipe(
      map((res) => {
        const normalized = this.normalizeOrder(res);
        const idx = this.localOrders.findIndex((o) => o.order_id === id);
        if (idx !== -1) this.localOrders[idx] = normalized;
        this.syncSignal();
        return normalized;
      }),
      catchError(() => {
        const normalized = this.normalizeOrder({ ...payload, order_id: id });
        const idx = this.localOrders.findIndex((o) => o.order_id === id);
        if (idx !== -1) this.localOrders[idx] = normalized;
        this.syncSignal();
        return of(normalized);
      })
    );
  }

  deleteOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      map(() => {
        this.localOrders = this.localOrders.filter((o) => o.order_id !== id);
        this.syncSignal();
      }),
      catchError(() => {
        this.localOrders = this.localOrders.filter((o) => o.order_id !== id);
        this.syncSignal();
        return of(void 0);
      })
    );
  }
}
