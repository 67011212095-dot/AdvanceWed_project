import { Injectable, signal } from '@angular/core';
import { Rider } from '../models/rider.model';

const STORAGE_KEY = 'fastnorder_riders';

// รายชื่อเริ่มต้น (ใช้ตอนยังไม่เคยบันทึกรายชื่อใน browser นี้)
const DEFAULT_RIDERS: Rider[] = [
  'สมชาย', 'วิชัย', 'ธีรศักดิ์', 'อนุชา', 'เอกพล', 'ชัยรัตน์',
  'ณัฐพล', 'ปิยะ', 'กิตติศักดิ์', 'ธนกร', 'วรวุฒิ', 'สุริยา'
].map((name, i) => ({ rider_id: i + 1, name }));

/**
 * จัดการรายชื่อไรเดอร์ (เพิ่ม/ลบ)
 * ตอนนี้เก็บไว้ใน localStorage ของ browser เท่านั้น
 * ถ้า backend มี API /api/riders แล้ว ให้เปลี่ยนเฉพาะ load/save ในไฟล์นี้
 */
@Injectable({ providedIn: 'root' })
export class RiderService {
  readonly riders = signal<Rider[]>(this.load());

  addRider(name: string, phone?: string): Rider | null {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const list = this.riders();
    const rider: Rider = {
      rider_id: list.length > 0 ? Math.max(...list.map((r) => r.rider_id)) + 1 : 1,
      name: trimmed,
      phone: phone?.trim() || undefined
    };
    this.save([...list, rider]);
    return rider;
  }

  removeRider(riderId: number): void {
    this.save(this.riders().filter((r) => r.rider_id !== riderId));
  }

  resetToDefault(): void {
    this.save([...DEFAULT_RIDERS]);
  }

  private load(): Rider[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // อ่าน localStorage ไม่ได้ (เช่น private mode) ใช้รายชื่อเริ่มต้นแทน
    }
    return [...DEFAULT_RIDERS];
  }

  private save(list: Rider[]): void {
    this.riders.set(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // บันทึกไม่ได้ก็ยังใช้งานต่อได้ในหน้านี้
    }
  }
}
