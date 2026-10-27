import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Customer } from '../models/customer.model';
import { CustomerService } from '../services/customer';
import { Order } from './order.model';
import { OrderService } from './order.service';
import { DispatchService, KITCHEN_LOCATION } from '../services/dispatch.service';

@Component({
    selector: 'app-orders',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule],
    templateUrl: './orders.html',
    styleUrl: './orders.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Orders implements OnInit {
    private readonly orderService = inject(OrderService);
    private readonly customerService = inject(CustomerService);
    private readonly dispatchService = inject(DispatchService);

    readonly orders = this.orderService.orders;
    readonly customers = signal<Customer[]>([]);

    readonly selectedLandmark = signal<string>('');
    readonly showManualCoords = signal<boolean>(false);
    readonly isLoading = signal(false);
    readonly isSaving = signal(false);
    readonly isModalOpen = signal(false);
    readonly isEditing = signal(false);
    readonly errorMessage = signal('');
    readonly currentOrder = signal<Order>(this.getEmptyOrder());
    readonly searchLatitude = signal<number | null>(null);
    readonly searchLongitude = signal<number | null>(null);
    readonly isNearbyFilterActive = signal(false);
    readonly searchTerm = signal<string>('');

    // คำนวณการแสดงผล Order (รองรับทั้ง ค้นหาชื่อ/ID และ ตัวกรองระยะทาง 2 กม.)
    readonly displayedOrders = computed(() => {
        let orders = this.orders();
        const search = this.searchTerm().trim().toLowerCase();
        const latitude = this.searchLatitude();
        const longitude = this.searchLongitude();

        // 1. กรองด้วยคำค้นหา (ชื่อลูกค้า หรือ Order ID)
        if (search) {
            orders = orders.filter((order) => {
                const customerName = this.getCustomerName(order.customer_id).toLowerCase();
                const orderId = `#${order.order_id || ''}`.toLowerCase();
                const rawOrderId = `${order.order_id || ''}`.toLowerCase();

                return customerName.includes(search) || orderId.includes(search) || rawOrderId.includes(search);
            });
        }

        // 2. กรองด้วยพิกัดเรดาร์ 2 กม. (ถ้ากดใช้งาน)
        if (!this.isNearbyFilterActive() || latitude === null || longitude === null) {
            return orders;
        }

        return orders.filter((order) =>
            this.getDistanceInKm(latitude, longitude, order.delivery_lat, order.delivery_lng) <= 2
        );
    });

    readonly canGenerateSamples = computed(() =>
        this.customers().some((customer) => customer.customer_id !== undefined)
    );

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
            box_quantity: 1,
            box_count: 1,
            order_status: 'pending',
            delivery_lat: KITCHEN_LOCATION.lat,
            delivery_lng: KITCHEN_LOCATION.lng
        };
    }

    setSearchTerm(value: string): void {
        this.searchTerm.set(value);
    }

    loadOrders(): void {
        this.isLoading.set(true);
        this.errorMessage.set('');
        this.orderService.getOrders().subscribe({
            next: () => {
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
        const custId = value ?? 0;
        const customer = this.customers().find((c) => c.customer_id === custId);
        this.currentOrder.update((order) => ({
            ...order,
            customer_id: custId,
            delivery_lat: customer ? customer.latitude : order.delivery_lat,
            delivery_lng: customer ? customer.longitude : order.delivery_lng
        }));
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

    setBoxQuantity(value: number | null): void {
        const val = value ?? 1;
        this.currentOrder.update((order) => ({
            ...order,
            box_quantity: val,
            box_count: val
        }));
    }

    setSearchLatitude(value: number | null): void {
        this.searchLatitude.set(value);
    }

    setSearchLongitude(value: number | null): void {
        this.searchLongitude.set(value);
    }

    useShopLocation(): void {
        this.searchLatitude.set(KITCHEN_LOCATION.lat);
        this.searchLongitude.set(KITCHEN_LOCATION.lng);
        this.selectedLandmark.set('ครัวร้านเดลิเวอรี (จุดเริ่มต้นส่ง)');
        this.applyNearbyFilter();
    }

    useCurrentLocation(): void {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = Math.round(pos.coords.latitude * 10000) / 10000;
                    const lng = Math.round(pos.coords.longitude * 10000) / 10000;
                    this.searchLatitude.set(lat);
                    this.searchLongitude.set(lng);
                    this.selectedLandmark.set('พิกัดปัจจุบันของคุณ');
                    this.applyNearbyFilter();
                },
                () => {
                    this.errorMessage.set('ไม่สามารถอ่านพิกัด GPS ได้');
                }
            );
        } else {
            this.errorMessage.set('เบราว์เซอร์ไม่รองรับ GPS');
        }
    }

    toggleManualCoords(): void {
        this.showManualCoords.update((v) => !v);
    }

    applyNearbyFilter(): void {
        const latitude = this.searchLatitude();
        const longitude = this.searchLongitude();
        if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            this.errorMessage.set('กรุณาระบุพิกัดละติจูดและลองจิจูดให้ถูกต้อง');
            return;
        }

        this.errorMessage.set('');
        this.isNearbyFilterActive.set(true);
    }

    clearNearbyFilter(): void {
        this.isNearbyFilterActive.set(false);
        this.searchLatitude.set(null);
        this.searchLongitude.set(null);
        this.selectedLandmark.set('');
        this.errorMessage.set('');
    }

    getDistanceFromSearchCenter(order: Order): number {
        return this.getDistanceInKm(
            this.searchLatitude() ?? 0,
            this.searchLongitude() ?? 0,
            order.delivery_lat,
            order.delivery_lng
        );
    }

    private getDistanceInKm(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
        const toRadians = (degrees: number) => degrees * Math.PI / 180;
        const latitudeDifference = toRadians(latitude2 - latitude1);
        const longitudeDifference = toRadians(longitude2 - longitude1);
        const haversine = Math.sin(latitudeDifference / 2) ** 2
            + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2))
            * Math.sin(longitudeDifference / 2) ** 2;

        return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }

    private getRandomOrderDate(): string {
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 30));
        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return localDate.toISOString().slice(0, 10);
    }

    openAddModal(): void {
        this.isEditing.set(false);
        this.currentOrder.set(this.getEmptyOrder());
        this.isModalOpen.set(true);
    }

    openEditModal(order: Order): void {
        this.isEditing.set(true);
        this.currentOrder.set({
            ...order,
            box_quantity: order.box_quantity || order.box_count || 1,
            box_count: order.box_quantity || order.box_count || 1,
            order_date: order.order_date.slice(0, 10)
        });
        this.isModalOpen.set(true);
    }

    closeModal(): void {
        this.isModalOpen.set(false);
    }

    saveOrder(): void {
        const order = this.currentOrder();
        const boxQty = order.box_quantity || order.box_count || 1;
        if (!order.customer_id) {
            this.errorMessage.set('กรุณาเลือกลูกค้าสำหรับ Order');
            return;
        }
        if (!Number.isInteger(boxQty) || boxQty < 1 || boxQty > 3) {
            this.errorMessage.set('เงื่อนไขของร้าน: จำนวนข้าวกล่องต้องอยู่ระหว่าง 1 ถึง 3 กล่องเท่านั้น');
            return;
        }

        const normalizedOrder: Order = {
            ...order,
            box_quantity: boxQty,
            box_count: boxQty
        };

        const request = this.isEditing() && order.order_id
            ? this.orderService.updateOrder(order.order_id, normalizedOrder)
            : this.orderService.addOrder(normalizedOrder);

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

    generateSampleOrders(): void {
        const customers = this.customers().filter(
            (customer): customer is Customer & { customer_id: number } => customer.customer_id !== undefined
        );
        if (customers.length === 0) {
            this.errorMessage.set('ไม่พบลูกค้าที่มีรหัสสำหรับสร้าง Order');
            return;
        }

        const numberOfOrders = 20 + Math.floor(Math.random() * 11);
        const sampleOrders: Order[] = Array.from({ length: numberOfOrders }, () => {
            const customer = customers[Math.floor(Math.random() * customers.length)];
            const boxQty = 1 + Math.floor(Math.random() * 3);
            return {
                customer_id: customer.customer_id,
                order_date: this.getRandomOrderDate(),
                box_quantity: boxQty,
                box_count: boxQty,
                order_status: 'pending',
                delivery_lat: customer.latitude,
                delivery_lng: customer.longitude
            };
        });

        this.isSaving.set(true);
        this.errorMessage.set('');
        forkJoin(sampleOrders.map((order) => this.orderService.addOrder(order))).subscribe({
            next: () => {
                this.isSaving.set(false);
                this.isNearbyFilterActive.set(false);
                this.loadOrders();
            },
            error: () => {
                this.isSaving.set(false);
                this.loadOrders();
                this.errorMessage.set('สร้าง Order จำลองไม่ครบ กรุณาตรวจสอบ API แล้วลองใหม่');
            }
        });
    }

    deleteAllOrders(): void {
        const orderIds = this.orders()
            .map((order) => order.order_id)
            .filter((id): id is number => id !== undefined);
        if (orderIds.length === 0 || !confirm(`ยืนยันการลบ Order ทั้งหมด ${orderIds.length} รายการหรือไม่?`)) {
            return;
        }

        this.isSaving.set(true);
        this.errorMessage.set('');
        forkJoin(orderIds.map((id) => this.orderService.deleteOrder(id))).subscribe({
            next: () => {
                this.isSaving.set(false);
                this.isNearbyFilterActive.set(false);
                this.loadOrders();
            },
            error: () => {
                this.isSaving.set(false);
                this.loadOrders();
                this.errorMessage.set('ลบ Order ได้ไม่ครบ กรุณาตรวจสอบ API แล้วลองใหม่');
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