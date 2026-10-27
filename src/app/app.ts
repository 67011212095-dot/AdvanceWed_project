import { Component, OnInit, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router'; // ← เพิ่ม
import { filter } from 'rxjs'; // ← เพิ่ม
import { Auth } from './services/auth'; // ← เพิ่ม
import { CustomerService } from './services/customer';
import { Customer } from './models/customer.model';
import { Order } from './models/order.model';
import { OrderService } from './orders/order.service';
import { DispatchService, KITCHEN_LOCATION } from './services/dispatch.service';
import { Orders } from './orders/orders';
import { DispatchConsole } from './dispatch/dispatch-console';
import { RiderView } from './rider/rider-view';
import { RiderManagement } from './riders/rider-management';
import { RiderService } from './services/rider.service';
import * as L from 'leaflet';

export interface LandmarkPreset {
  name: string;
  category: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, Orders, DispatchConsole, RiderView, RiderManagement, RouterOutlet], // ← เพิ่ม RouterOutlet
  templateUrl: './app.html'
})
export class App implements OnInit {
  private readonly customerService = inject(CustomerService);
  private readonly orderService = inject(OrderService);
  readonly dispatchService = inject(DispatchService);
  readonly riderService = inject(RiderService);
  private readonly router = inject(Router); // ← เพิ่ม
  private readonly auth = inject(Auth); // ← เพิ่ม
  private map!: L.Map;
  private marker!: L.Marker;

  // ← เพิ่ม: เช็กว่าอยู่หน้า login หรือไม่
  get isLoginPage(): boolean {
    return this.router.url.startsWith('/login') || this.router.url === '/';
  }

  // ← เพิ่ม: ออกจากระบบ
  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // การนำทางหลัก
  activeRole: 'owner' | 'rider' = 'owner';
  ownerTab: 'dispatch' | 'orders' | 'customers' | 'riders' = 'dispatch';
  selectedRiderJobId: number | null = null;

  // ข้อมูลลูกค้าและออเดอร์
  customers: Customer[] = [];
  get orders(): Order[] {
    return this.orderService.orders();
  }
  isLoading: boolean = false;

  // ฟิลด์สำหรับการค้นหาลูกค้า
  searchKeyword: string = '';
  searchLat: number | null = null;
  searchLng: number | null = null;
  selectedLandmark: string = '';
  showManualCoords: boolean = false;

  // รายการสถานที่สำคัญรอบ ม.มหาสารคาม สำหรับเรดาร์ 1 กม.
  readonly MSU_LANDMARKS: LandmarkPreset[] = [
    { name: 'ครัวร้านเดลิเวอรี (จุดเริ่มต้นส่ง)', category: 'ร้านอาหาร', lat: 16.2468, lng: 103.2519 },
    { name: 'หอพักตักศิลา (หน้าป้าย มมส.)', category: 'หอพัก', lat: 16.2492, lng: 103.2541 },
    { name: 'คณะวิทยาการสารสนเทศ (IT)', category: 'มหาวิทยาลัย', lat: 16.2451, lng: 103.2560 },
    { name: 'คณะวิศวกรรมศาสตร์', category: 'มหาวิทยาลัย', lat: 16.2478, lng: 103.2485 },
    { name: 'อาคารราชนครินทร์ (RN)', category: 'มหาวิทยาลัย', lat: 16.2510, lng: 103.2530 },
    { name: 'หอพักอินเตอร์', category: 'หอพัก', lat: 16.2435, lng: 103.2502 },
    { name: 'หอพักเจริญสุข', category: 'หอพัก', lat: 16.2420, lng: 103.2575 },
    { name: 'คอนโดเดอะแคปิตอล', category: 'คอนโด', lat: 16.2440, lng: 103.2450 },
    { name: 'ศูนย์อาหารขามเรียง', category: 'ชุมชน', lat: 16.2415, lng: 103.2525 }
  ];

  // จัดการ Popup Modal เพิ่ม/แก้ไขลูกค้า
  isModalOpen: boolean = false;
  isEditing: boolean = false;
  currentCustomer: Customer = this.getEmptyCustomer();


  get isDispatch(): boolean {
    return localStorage.getItem('role') === 'dispatch';
  }

  ngOnInit(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isLoginPage) return;

        const role = localStorage.getItem('role');

        // ถ้าเป็นไรเดอร์ บังคับให้เป็น 'rider' เสมอ ห้ามเปลี่ยนเป็น 'owner'
        if (role === 'rider') {
          this.activeRole = 'rider';
        } else {
          this.activeRole = this.router.url.startsWith('/rider') ? 'rider' : 'owner';
        }

        this.loadCustomers();
        this.loadOrders();
      });
  }

  isNearbyFilterActive(): boolean {
    return this.searchLat !== null && this.searchLng !== null;
  }

  //  เพิ่มฟังก์ชันนี้เข้าไปใน app_4.ts เพื่อคำนวณระยะทางแบบเดียวกับหน้า Order
  getCustomerDistance(customer: Customer): number {
    if (this.searchLat === null || this.searchLng === null || !customer.latitude || !customer.longitude) {
      return 0;
    }
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const latitudeDifference = toRadians(customer.latitude - this.searchLat);
    const longitudeDifference = toRadians(customer.longitude - this.searchLng);
    const haversine = Math.sin(latitudeDifference / 2) ** 2
      + Math.cos(toRadians(this.searchLat)) * Math.cos(toRadians(customer.latitude))
      * Math.sin(longitudeDifference / 2) ** 2;

    return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  getEmptyCustomer(): Customer {
    return {
      first_name: '',
      last_name: '',
      phone: '',
      latitude: KITCHEN_LOCATION.lat,
      longitude: KITCHEN_LOCATION.lng
    };
  }

  // ดึงข้อมูลลูกค้าทั้งหมด
  loadCustomers(): void {
    this.isLoading = true;
    this.customerService.getCustomers().subscribe({
      next: (data) => {
        this.customers = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('API Error:', err);
        this.isLoading = false;
      }
    });
  }

  // ดึงข้อมูลออเดอร์ทั้งหมด
  loadOrders(): void {
    this.orderService.getOrders().subscribe({
      error: (err) => {
        console.error('API Error:', err);
      }
    });
  }

  // สลับไปยังหน้าจอไรเดอร์พร้อมเลือกใบงาน
  onViewRiderJob(jobId: number): void {
    this.selectedRiderJobId = jobId;
    this.activeRole = 'rider';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // รายชื่อไรเดอร์เปลี่ยน: ถ้าจัดเส้นทางไว้แล้วให้แจกงานใหม่ตามรายชื่อล่าสุด
  onRidersChanged(): void {
    if (this.dispatchService.deliveryJobs().length > 0 && this.orders.length > 0) {
      this.dispatchService.optimizeRoutes(
        this.orders,
        this.customers,
        this.dispatchService.activeAlternativeIndex()
      );
    }
  }

  // ค้นหาลูกค้าจากส่วนหนึ่งของชื่อ หรือนามสกุล
  onSearchByName(): void {
    if (!this.searchKeyword.trim()) {
      this.loadCustomers();
      return;
    }
    this.isLoading = true;
    this.customerService.searchByName(this.searchKeyword).subscribe({
      next: (data) => {
        this.customers = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  // เลือกสถานที่สำคัญจาก Dropdown
  onSelectLandmark(landmarkName: string): void {
    const item = this.MSU_LANDMARKS.find((l) => l.name === landmarkName);
    if (item) {
      this.searchLat = item.lat;
      this.searchLng = item.lng;
      this.selectedLandmark = item.name;
      this.onSearchNearby();
    }
  }

  // ปุ่มลัด: ใช้ตำแหน่งครัวร้าน
  useShopLocation(): void {
    this.searchLat = KITCHEN_LOCATION.lat;
    this.searchLng = KITCHEN_LOCATION.lng;
    this.selectedLandmark = 'ครัวร้านเดลิเวอรี (จุดเริ่มต้นส่ง)';
    this.onSearchNearby();
  }

  // ปุ่มลัด: ใช้ตำแหน่ง GPS ปัจจุบัน
  useCurrentLocation(): void {
    if (navigator.geolocation) {
      this.isLoading = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.searchLat = Math.round(pos.coords.latitude * 10000) / 10000;
          this.searchLng = Math.round(pos.coords.longitude * 10000) / 10000;
          this.selectedLandmark = 'พิกัดปัจจุบันของคุณ';
          this.onSearchNearby();
        },
        () => {
          this.isLoading = false;
          alert('ไม่สามารถอ่านพิกัด GPS ได้ กรุณาเลือกจากสถานที่สำคัญรอบ มมส.');
        }
      );
    } else {
      alert('เบราว์เซอร์ไม่รองรับ Geolocation');
    }
  }

  // ค้นหาลูกค้าในระยะ 1 กิโลเมตรจากพิกัด
  onSearchNearby(): void {
    if (this.searchLat === null || this.searchLng === null) {
      alert('กรุณาเลือกสถานที่หรือระบุพิกัด Latitude และ Longitude');
      return;
    }
    this.isLoading = true;
    this.customerService.searchNearby(this.searchLat, this.searchLng).subscribe({
      next: (data) => {
        this.customers = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  // ล้างค่าเรดาร์ค้นหา
  clearNearbySearch(): void {
    this.searchLat = null;
    this.searchLng = null;
    this.selectedLandmark = '';
    this.loadCustomers();
  }

  // เปิด Modal เพิ่มข้อมูลลูกค้า
  openAddModal(): void {
    this.isEditing = false;
    this.currentCustomer = this.getEmptyCustomer();
    this.isModalOpen = true;
    this.initMapWithDelay();
  }

  // เปิด Modal แก้ไขข้อมูลลูกค้า
  openEditModal(customer: Customer): void {
    this.isEditing = true;
    this.currentCustomer = { ...customer };
    this.isModalOpen = true;
    this.initMapWithDelay();
  }

  private initMapWithDelay(): void {
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  private initMap(): void {
    // ล้างแผนที่เก่าถ้ามีการเปิด Modal ซ้ำ
    if (this.map) {
      this.map.remove();
    }

    const lat = this.currentCustomer.latitude || 16.2468;
    const lng = this.currentCustomer.longitude || 103.2519;

    this.map = L.map('customer-map').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    const icon = L.icon({
      iconUrl: '/assets/marker-icon.png',
      iconSize: [40, 40],
      iconAnchor: [20, 50]
    });

    this.marker = L.marker([lat, lng], { icon }).addTo(this.map);

    // ดักจับการคลิกเพื่อเปลี่ยนค่าพิกัดของ currentCustomer
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;
      this.marker.setLatLng([clickedLat, clickedLng]);

      // อัปเดตค่าลงใน Object โดยตรงเพื่อให้หน้าจออัปเดตตาม
      this.currentCustomer.latitude = clickedLat;
      this.currentCustomer.longitude = clickedLng;
    });
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  // บันทึกข้อมูลลูกค้า (Add / Edit)
  saveCustomer(): void {
    if (this.isEditing && this.currentCustomer.customer_id) {
      this.customerService.updateCustomer(this.currentCustomer.customer_id, this.currentCustomer).subscribe({
        next: () => {
          this.closeModal();
          this.loadCustomers();
        },
        error: () => alert('เกิดข้อผิดพลาดในการแก้ไขข้อมูล')
      });
    } else {
      this.customerService.addCustomer(this.currentCustomer).subscribe({
        next: () => {
          this.closeModal();
          this.loadCustomers();
        },
        error: () => alert('เกิดข้อผิดพลาดในการเพิ่มลูกค้า')
      });
    }
  }

  // ลบข้อมูลลูกค้า
  deleteCustomer(id: number | undefined): void {
    if (!id) return;
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลลูกค้ารายนี้?')) {
      this.customerService.deleteCustomer(id).subscribe({
        next: () => this.loadCustomers(),
        error: () => alert('เกิดข้อผิดพลาดในการลบข้อมูล')
      });
    }
  }
}