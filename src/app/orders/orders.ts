import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Customer } from '../models/customer.model';
import { CustomerService } from '../services/customer';
import { Order } from './order.model';
import { OrderService } from './order.service';

@Component({
    selector: 'app-orders',
    imports: [CommonModule, DatePipe, FormsModule],
    templateUrl: './orders.html',
    styleUrl: './orders.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Orders implements OnInit {
    private readonly orderService = inject(OrderService);
    private readonly customerService = inject(CustomerService);

    readonly orders = signal<Order[]>([]);
    readonly customers = signal<Customer[]>([]);
    readonly isLoading = signal(false);
    readonly isSaving = signal(false);
    readonly isModalOpen = signal(false);
    readonly isEditing = signal(false);
    readonly errorMessage = signal('');
    readonly currentOrder = signal<Order>(this.getEmptyOrder());

    ngOnInit(): void {
        this.loadOrders();
        this.customerService.getCustomers().subscribe({
            next: (customers) => this.customers.set(customers),
            error: () => this.errorMessage.set('โหลดรายชื่อลูกค้าไม่สำเร็จ')
        });
    }

    private getTodayDate(): string {
        const today = new Date();
        const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
        return localDate.toISOString().slice(0, 10);
    }

    private getEmptyOrder(): Order {
        return {
            customer_id: 0,
            order_date: this.getTodayDate(),
            delivery_lat: 0,
            delivery_lng: 0
        };
    }

    loadOrders(): void {
        this.isLoading.set(true);
        this.errorMessage.set('');
        this.orderService.getOrders().subscribe({
            next: (orders) => {
                this.orders.set(orders);
                this.isLoading.set(false);
            },
            error: () => {
                this.errorMessage.set('โหลดรายการ Order ไม่สำเร็จ');
                this.isLoading.set(false);
            }
        });
    }

    getCustomerName(customerId: number): string {
        const customer = this.customers().find((item) => item.customer_id === customerId);
        return customer ? `${customer.first_name} ${customer.last_name}` : `#${customerId}`;
    }

    setCustomerId(value: number | null): void {
        this.currentOrder.update((order) => ({ ...order, customer_id: value ?? 0 }));
    }

    setOrderDate(value: string): void {
        this.currentOrder.update((order) => ({ ...order, order_date: value }));
    }

    setDeliveryLat(value: number | null): void {
        this.currentOrder.update((order) => ({ ...order, delivery_lat: value ?? 0 }));
    }

    setDeliveryLng(value: number | null): void {
        this.currentOrder.update((order) => ({ ...order, delivery_lng: value ?? 0 }));
    }

    openAddModal(): void {
        this.isEditing.set(false);
        this.currentOrder.set(this.getEmptyOrder());
        this.isModalOpen.set(true);
    }

    openEditModal(order: Order): void {
        this.isEditing.set(true);
        this.currentOrder.set({ ...order, order_date: order.order_date.slice(0, 10) });
        this.isModalOpen.set(true);
    }

    closeModal(): void {
        this.isModalOpen.set(false);
    }

    saveOrder(): void {
        const order = this.currentOrder();
        if (!order.customer_id) {
            this.errorMessage.set('กรุณาเลือกลูกค้าสำหรับ Order');
            return;
        }

        const request = this.isEditing() && order.order_id
            ? this.orderService.updateOrder(order.order_id, order)
            : this.orderService.addOrder(order);

        this.isSaving.set(true);
        this.errorMessage.set('');
        request.subscribe({
            next: () => {
                this.isSaving.set(false);
                this.closeModal();
                this.loadOrders();
            },
            error: () => {
                this.isSaving.set(false);
                this.errorMessage.set('บันทึก Order ไม่สำเร็จ');
            }
        });
    }

    deleteOrder(id: number | undefined): void {
        if (id === undefined || !confirm('ยืนยันการลบ Order นี้หรือไม่?')) return;

        this.orderService.deleteOrder(id).subscribe({
            next: () => this.loadOrders(),
            error: () => this.errorMessage.set('ลบ Order ไม่สำเร็จ')
        });
    }
}