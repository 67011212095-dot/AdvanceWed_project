import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService } from './services/customer';
import { Customer } from './models/customer.model';
import { Orders } from './orders/orders';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, Orders],
  templateUrl: './app.html'
})
export class App implements OnInit {
  customers: Customer[] = [];
  isLoading: boolean = false;

  // ฟิลด์สำหรับการค้นหา
  searchKeyword: string = '';
  searchLat: number | null = null;
  searchLng: number | null = null;

  // จัดการ Popup Modal เพิ่ม/แก้ไข
  isModalOpen: boolean = false;
  isEditing: boolean = false;
  currentCustomer: Customer = this.getEmptyCustomer();

  constructor(private customerService: CustomerService) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  getEmptyCustomer(): Customer {
    return {
      first_name: '',
      last_name: '',
      phone: '',
      latitude: 0,
      longitude: 0
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

  // ค้นหาจากส่วนหนึ่งของชื่อ หรือนามสกุล
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

  // ค้นหาลูกค้าในระยะ 1 กิโลเมตรจากพิกัด
  onSearchNearby(): void {
    if (this.searchLat === null || this.searchLng === null) {
      alert('กรุณากรอกทั้ง Latitude และ Longitude ให้ครบถ้วน');
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

  // เปิด Modal เพิ่มข้อมูล
  openAddModal(): void {
    this.isEditing = false;
    this.currentCustomer = this.getEmptyCustomer();
    this.isModalOpen = true;
  }

  // เปิด Modal แก้ไขข้อมูล
  openEditModal(customer: Customer): void {
    this.isEditing = true;
    this.currentCustomer = { ...customer };
    this.isModalOpen = true;
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