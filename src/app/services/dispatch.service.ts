import { Injectable, signal, computed, inject } from '@angular/core';
import { Order, OrderStatus } from '../models/order.model';
import { DeliveryJob } from '../models/delivery-job.model';
import { Customer } from '../models/customer.model';
import { RiderService } from './rider.service';

export const KITCHEN_LOCATION = {
  lat: 16.2468,
  lng: 103.2519,
  name: 'ครัวร้านข้าวกล่องเดลิเวอรี (ส่งด่วนมื้อเที่ยง มมส.)'
};

const ROUTE_COLORS = [
  '#EF4444', // แดง
  '#10B981', // เขียว
  '#3B82F6', // น้ำเงิน
  '#F59E0B', // เหลืองอำพัน
  '#8B5CF6', // ม่วง
  '#EC4899', // ชมพูบานเย็น
  '#06B6D4', // ฟ้าสว่าง
  '#F97316', // ส้ม
  '#14B8A6', // เขียวอมฟ้า
  '#6366F1', // น้ำเงินอินดิโก
  '#84CC16', // เขียวมะนาว
  '#D946EF'  // ม่วงบานเย็น
];

@Injectable({
  providedIn: 'root'
})
export class DispatchService {
  private readonly riderService = inject(RiderService);

  // สัญญาณเก็บรายการ Jobs ที่จัดเส้นทางแล้ว
  readonly deliveryJobs = signal<DeliveryJob[]>([]);
  readonly activeAlternativeIndex = signal<number>(0);
  readonly isOptimizing = signal<boolean>(false);

  // คำนวณสรุปผลภาพรวมทางการเงินและประสิทธิภาพ
  readonly summary = computed(() => {
    const jobs = this.deliveryJobs();
    let totalRevenue = 0;
    let totalFoodCost = 0;
    let totalRiderCost = 0;
    let totalBoxes = 0;
    let totalDistance = 0;
    let maxTime = 0;
    let delayedCount = 0;

    for (const job of jobs) {
      totalRevenue += job.revenue || 0;
      totalFoodCost += job.food_cost || 0;
      totalRiderCost += job.total_cost || 0;
      totalBoxes += job.total_boxes || 0;
      totalDistance += job.total_distance || 0;
      if (job.estimated_time > maxTime) maxTime = job.estimated_time;
      if (job.is_delayed) delayedCount++;
    }

    const netProfit = totalRevenue - totalFoodCost - totalRiderCost;

    return {
      jobCount: jobs.length,
      totalBoxes,
      totalRevenue,
      totalFoodCost,
      totalRiderCost,
      netProfit,
      totalDistance: Math.round(totalDistance * 10) / 10,
      maxEstimatedTime: Math.round(maxTime),
      delayedCount,
      allOnTime: delayedCount === 0
    };
  });

  // Haversine คำนวณระยะทางระหว่าง 2 พิกัด (กิโลเมตร)
  getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // รัศมีโลกเป็น กม.
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // คำนวณมุมองศาเทียบกับร้าน (Polar angle) สำหรับแบ่งโซนไม่ให้วิ่งไขว้
  private getAngleFromKitchen(lat: number, lng: number): number {
    const dLng = lng - KITCHEN_LOCATION.lng;
    const dLat = lat - KITCHEN_LOCATION.lat;
    let angle = Math.atan2(dLat, dLng) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
  }

  /**
   * อัลกอริทึมจัดเส้นทางอัจฉริยะ (Smart Route Optimization)
   * 1. กรองออเดอร์ที่พร้อมจัดส่ง
   * 2. จัดกลุ่มเชิงพื้นที่ (Spatial Clustering) ตามองศาและระยะทางจากร้าน ไม่ให้วิ่งไขว้ข้ามเมือง
   * 3. แต่ละกลุ่มไม่เกิน 3 ออเดอร์ และกล่องรวมไม่เกิน 10 กล่อง
   * 4. จัดลำดับจุดส่ง (Traveling Stop Sequence: Kitchen -> 1 -> 2 -> 3)
   * 5. คำนวณเวลา (30 กม./ชม. + จุดละ 3 นาที) และค่าจ้าง (15 บ. + 2 บ./กม./กล่อง)
   */
  optimizeRoutes(
    orders: Order[],
    customers: Customer[],
    alternativeSeed: number = 0
  ): DeliveryJob[] {
    if (!orders || orders.length === 0) {
      this.deliveryJobs.set([]);
      return [];
    }

    // เติมข้อมูลลูกค้าเข้าไปใน Order
    const enrichedOrders: Order[] = orders.map((o) => {
      const cust = customers.find((c) => c.customer_id === o.customer_id);
      return {
        ...o,
        box_quantity: o.box_quantity || o.box_count || 1,
        customer_name: cust ? `${cust.first_name} ${cust.last_name}` : `ลูกค้า #${o.customer_id}`,
        customer_phone: cust?.phone || '08X-XXX-XXXX'
      };
    });

    // คำนวณมุมและระยะทางจากร้านสำหรับแต่ละออเดอร์
    const ordersWithGeo = enrichedOrders.map((o) => {
      const angle = this.getAngleFromKitchen(o.delivery_lat, o.delivery_lng);
      const distFromKitchen = this.getDistanceKm(
        KITCHEN_LOCATION.lat,
        KITCHEN_LOCATION.lng,
        o.delivery_lat,
        o.delivery_lng
      );
      return { order: o, angle, distFromKitchen };
    });

    // หากมีการเลือกทางเลือกที่ 2 หรือ 3 ให้หมุนมุมเริ่มต้นหรือจัดกลุ่มตามระยะทาง
    if (alternativeSeed === 1) {
      // ทางเลือก 2: เรียงตามระยะทางจากร้านก่อน (ส่งรัศมีใกล้ก่อน)
      ordersWithGeo.sort((a, b) => a.distFromKitchen - b.distFromKitchen || a.angle - b.angle);
    } else if (alternativeSeed === 2) {
      // ทางเลือก 3: หมุนองศาเริ่มจากทิศตรงข้าม
      ordersWithGeo.sort((a, b) => ((a.angle + 180) % 360) - ((b.angle + 180) % 360));
    } else {
      // ทางเลือก 1 (มาตรฐาน): เรียงกวาดตามองศารอบร้าน (Angular Sweep)
      ordersWithGeo.sort((a, b) => a.angle - b.angle || a.distFromKitchen - b.distFromKitchen);
    }

    // จัดกลุ่มเข้า Job: สูงสุด 3 ออเดอร์ต่อคน และกล่องรวมไม่เกิน 10 กล่อง
    const clusters: Order[][] = [];
    let currentCluster: Order[] = [];
    let currentBoxCount = 0;

    for (const item of ordersWithGeo) {
      const bQty = item.order.box_quantity;
      if (
        currentCluster.length >= 3 ||
        (currentCluster.length > 0 && currentBoxCount + bQty > 10)
      ) {
        clusters.push(currentCluster);
        currentCluster = [];
        currentBoxCount = 0;
      }
      currentCluster.push(item.order);
      currentBoxCount += bQty;
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // สร้าง DeliveryJob สำหรับแต่ละกลุ่ม
    // แจกงานให้ไรเดอร์ตามรายชื่อในหน้า "จัดการไรเดอร์" วนไปเรื่อยๆ
    // ถ้าใบงานมากกว่าจำนวนไรเดอร์ คนเดิมจะได้รอบที่ 2, 3, ...
    const riders = this.riderService.riders();
    const jobs: DeliveryJob[] = clusters.map((clusterOrders, index) => {
      const jobId = 1001 + index;
      let riderName = 'ยังไม่มีไรเดอร์ (เพิ่มในหน้าจัดการไรเดอร์)';
      if (riders.length > 0) {
        const rider = riders[index % riders.length];
        const round = Math.floor(index / riders.length) + 1;
        riderName = `ไรเดอร์ ${rider.name}` + (round > 1 ? ` (รอบที่ ${round})` : '');
      }
      const routeColor = ROUTE_COLORS[index % ROUTE_COLORS.length];

      // จัดลำดับจุดส่งให้สั้นที่สุด (Kitchen -> Nearest 1 -> Nearest 2 -> Nearest 3)
      const sequencedOrders: Order[] = [];
      let currentLat = KITCHEN_LOCATION.lat;
      let currentLng = KITCHEN_LOCATION.lng;
      const remaining = [...clusterOrders];
      let totalDistance = 0;

      while (remaining.length > 0) {
        let bestIndex = 0;
        let bestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const d = this.getDistanceKm(
            currentLat,
            currentLng,
            remaining[i].delivery_lat,
            remaining[i].delivery_lng
          );
          if (d < bestDist) {
            bestDist = d;
            bestIndex = i;
          }
        }
        const nextOrder = remaining.splice(bestIndex, 1)[0];
        totalDistance += bestDist;
        currentLat = nextOrder.delivery_lat;
        currentLng = nextOrder.delivery_lng;

        sequencedOrders.push({
          ...nextOrder,
          job_id: jobId,
          order_status: nextOrder.order_status || 'assigned',
          stop_sequence: sequencedOrders.length + 1,
          distance_from_prev: Math.round(bestDist * 100) / 100
        });
      }

      const totalBoxes = sequencedOrders.reduce((sum, o) => sum + (o.box_quantity || 1), 0);

      // คำนวณค่าจ้างไรเดอร์ตามโจทย์:
      // ค่าเรียก 15 บาท + (2 บาท * จำนวนกล่อง * ระยะทางรวม กม.)
      const roundDistance = Math.max(0.5, Math.round(totalDistance * 10) / 10);
      const riderCost = Math.round(15 + totalBoxes * 2 * roundDistance);

      // คำนวณเวลา: ความเร็ว 30 กม./ชม. (2 นาที/กม.) + เวลาแวะส่งจุดละ 3 นาที
      const drivingTimeMinutes = roundDistance * 2;
      const stopTimeMinutes = sequencedOrders.length * 3;
      const estimatedTime = Math.round(drivingTimeMinutes + stopTimeMinutes);

      // การเงิน
      const revenue = totalBoxes * 65;
      const foodCost = totalBoxes * 40;
      const netProfit = revenue - foodCost - riderCost;
      const isDelayed = estimatedTime > 60; // เกิน 60 นาที = เสี่ยงเลท 12:30 น.

      return {
        job_id: jobId,
        rider_name: riderName,
        route_color: routeColor,
        total_boxes: totalBoxes,
        total_distance: roundDistance,
        total_cost: riderCost,
        estimated_time: estimatedTime,
        orders: sequencedOrders,
        revenue,
        food_cost: foodCost,
        netProfit,
        is_delayed: isDelayed,
        status: 'assigned'
      };
    });

    this.deliveryJobs.set(jobs);
    return jobs;
  }

  // เสนอเส้นทางทางเลือก (Recalculate)
  recalculateNextAlternative(orders: Order[], customers: Customer[]): DeliveryJob[] {
    const nextIndex = (this.activeAlternativeIndex() + 1) % 3;
    this.activeAlternativeIndex.set(nextIndex);
    return this.optimizeRoutes(orders, customers, nextIndex);
  }

  // ดึง Job สำหรับ Rider View
  getJobById(jobId: number): DeliveryJob | undefined {
    return this.deliveryJobs().find((j) => j.job_id === jobId);
  }

  // อัปเดตสถานะออเดอร์ (เช่น ส่งสำเร็จ)
  updateOrderStatus(jobId: number, orderId: number, status: OrderStatus): void {
    this.deliveryJobs.update((jobs) =>
      jobs.map((job) => {
        if (job.job_id !== jobId) return job;
        const updatedOrders = job.orders.map((o) =>
          o.order_id === orderId ? { ...o, order_status: status } : o
        );
        const allDone = updatedOrders.every((o) => o.order_status === 'delivered');
        return {
          ...job,
          orders: updatedOrders,
          status: allDone ? 'completed' : 'in_transit'
        };
      })
    );
  }
}

