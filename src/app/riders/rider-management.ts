import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RiderService } from '../services/rider.service';
import { DispatchService } from '../services/dispatch.service';
import { Rider } from '../models/rider.model';

@Component({
  selector: 'app-rider-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rider-management.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RiderManagement {
  readonly riderService = inject(RiderService);
  readonly dispatchService = inject(DispatchService);

  // แจ้ง App ให้จัดเส้นทางใหม่เมื่อรายชื่อไรเดอร์เปลี่ยน
  @Output() ridersChanged = new EventEmitter<void>();

  newName = '';
  newPhone = '';
  error = signal('');

  readonly riderCount = computed(() => this.riderService.riders().length);
  readonly jobCount = computed(() => this.dispatchService.deliveryJobs().length);

  // ใบงานมากกว่าไรเดอร์ = บางคนต้องวิ่งหลายรอบ
  readonly shortage = computed(() => Math.max(0, this.jobCount() - this.riderCount()));

  // จำนวนใบงานที่แต่ละคนได้รับจากการจัดเส้นทางล่าสุด
  jobsForRider(rider: Rider): number {
    const prefix = `ไรเดอร์ ${rider.name}`;
    return this.dispatchService
      .deliveryJobs()
      .filter((j) => j.rider_name === prefix || j.rider_name.startsWith(prefix + ' (รอบที่')).length;
  }

  addRider(): void {
    const name = this.newName.trim();
    if (!name) {
      this.error.set('กรุณากรอกชื่อไรเดอร์');
      return;
    }
    if (this.riderService.riders().some((r) => r.name === name)) {
      this.error.set('มีไรเดอร์ชื่อนี้อยู่แล้ว');
      return;
    }
    this.riderService.addRider(name, this.newPhone);
    this.newName = '';
    this.newPhone = '';
    this.error.set('');
    this.ridersChanged.emit();
  }

  removeRider(rider: Rider): void {
    if (!confirm(`ลบ "${rider.name}" ออกจากรายชื่อไรเดอร์?`)) return;
    this.riderService.removeRider(rider.rider_id);
    this.ridersChanged.emit();
  }

  resetToDefault(): void {
    if (!confirm('คืนค่ารายชื่อไรเดอร์เริ่มต้น 12 คน? รายชื่อที่เพิ่มเองจะหายไป')) return;
    this.riderService.resetToDefault();
    this.error.set('');
    this.ridersChanged.emit();
  }
}
