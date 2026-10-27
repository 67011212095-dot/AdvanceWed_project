import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Order } from '../orders/order.model';
import { Customer } from '../models/customer.model';
import { DeliveryJob } from '../models/delivery-job.model';
import { DispatchService, KITCHEN_LOCATION } from '../services/dispatch.service';

@Component({
  selector: 'app-dispatch-console',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './dispatch-console.html',
  styleUrl: './dispatch-console.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DispatchConsole implements AfterViewInit, OnChanges, OnDestroy {
  readonly dispatchService = inject(DispatchService);

  @Input() orders: any[] = [];
  @Input() customers: Customer[] = [];
  @Output() viewRiderJob = new EventEmitter<number>();

  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private layerGroup?: L.LayerGroup;
  selectedJobId: number | null = null;

  ngAfterViewInit(): void {
    this.initMap();
    if (this.orders.length > 0 && this.dispatchService.deliveryJobs().length === 0) {
      this.runOptimization();
    } else {
      this.renderMapRoutes();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['orders'] || changes['customers']) && this.map) {
      if (this.dispatchService.deliveryJobs().length > 0) {
        this.renderMapRoutes();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    if (!this.mapContainer?.nativeElement) return;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [KITCHEN_LOCATION.lat, KITCHEN_LOCATION.lng],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors | fastNorder'
    }).addTo(this.map);

    this.layerGroup = L.layerGroup().addTo(this.map);
  }

  runOptimization(): void {
    if (this.orders.length === 0) return;
    this.dispatchService.optimizeRoutes(this.orders, this.customers, 0);
    this.renderMapRoutes();
  }

  recalculateAlternative(): void {
    if (this.orders.length === 0) return;
    this.dispatchService.recalculateNextAlternative(this.orders, this.customers);
    this.renderMapRoutes();
  }

  selectJob(jobId: number | null): void {
    this.selectedJobId = this.selectedJobId === jobId ? null : jobId;
    this.renderMapRoutes();
  }

  openRiderView(jobId: number): void {
    this.viewRiderJob.emit(jobId);
  }

  private async renderMapRoutes(): Promise<void> {
    if (!this.map || !this.layerGroup) return;

    this.layerGroup.clearLayers();

    const jobs = this.dispatchService.deliveryJobs();
    const bounds = L.latLngBounds([KITCHEN_LOCATION.lat, KITCHEN_LOCATION.lng], [
      KITCHEN_LOCATION.lat,
      KITCHEN_LOCATION.lng
    ]);

    // 1. ปักหมุดร้าน / ครัว
    const kitchenIcon = L.divIcon({
      className: '',
      html: `
        <div style="background: #047857; color: white; border-radius: 12px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.25);">
          <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const kitchenMarker = L.marker([KITCHEN_LOCATION.lat, KITCHEN_LOCATION.lng], {
      icon: kitchenIcon,
      zIndexOffset: 1000
    }).bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
        <strong style="color: #047857; font-size: 13px;">${KITCHEN_LOCATION.name}</strong><br>
        จุดเริ่มต้นส่งข้าวกล่องรอบ 11:30 น.<br>
        เป้าหมาย: ส่งถึงมือลูกค้าทุกคนก่อน 12:30 น.
      </div>
    `);

    this.layerGroup.addLayer(kitchenMarker);

    // 2. ปักหมุดและวาดเส้นทางตามถนนจริงสำหรับแต่ละ Job
    const displayJobs = this.selectedJobId
      ? jobs.filter((j) => j.job_id === this.selectedJobId)
      : jobs;

    for (const job of displayJobs) {
      const isSelected = this.selectedJobId === job.job_id;

      // สร้างลำดับพิกัด: [ลองจิจูด, ละติจูด] สำหรับเรียก OSRM API (OSRM ใช้ lng,lat)
      const waypoints = [
        `${KITCHEN_LOCATION.lng},${KITCHEN_LOCATION.lat}`,
        ...job.orders.map((o: any) => `${o.delivery_lng},${o.delivery_lat}`)
      ];

      // ปักหมุดจุดส่งลูกค้า
      for (const order of job.orders) {
        bounds.extend([order.delivery_lat, order.delivery_lng]);

        const stopIcon = L.divIcon({
          className: '',
          html: `
            <div style="
              background-color: ${job.route_color};
              color: white;
              border-radius: 9999px;
              width: ${isSelected ? 32 : 28}px;
              height: ${isSelected ? 32 : 28}px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              font-size: 13px;
              border: 2.5px solid white;
              box-shadow: 0 4px 8px rgba(0,0,0,0.25);
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
              transition: all 0.2s;
            ">
              ${order.stop_sequence || 1}
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const stopMarker = L.marker([order.delivery_lat, order.delivery_lng], {
          icon: stopIcon,
          zIndexOffset: isSelected ? 800 : 500
        }).bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.5;">
            <div style="display: inline-block; padding: 2px 6px; background-color: ${job.route_color}; color: white; border-radius: 6px; font-weight: bold; font-size: 10px; margin-bottom: 4px;">
              ${job.rider_name} - จุดส่งที่ #${order.stop_sequence}
            </div>
            <div><strong>ลูกค้า:</strong> ${order.customer_name || 'ลูกค้า #' + order.customer_id}</div>
            <div><strong>ข้าวกล่อง:</strong> ${order.box_quantity} กล่อง</div>
            <div><strong>เบอร์โทร:</strong> ${order.customer_phone || '-'}</div>
            <div><strong>พิกัด:</strong> ${order.delivery_lat}, ${order.delivery_lng}</div>
          </div>
        `);

        this.layerGroup.addLayer(stopMarker);
      }

      // ดึงเส้นทางวิ่งตามถนนจริงจาก OSRM API
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints.join(';')}?overview=full&geometries=geojson`;
        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          // แปลงพิกัดจาก GeoJSON [lng, lat] เป็น Leaflet [lat, lng]
          const roadCoordinates: L.LatLngExpression[] = data.routes[0].geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]]
          );

          const polyline = L.polyline(roadCoordinates, {
            color: job.route_color,
            weight: isSelected ? 6 : 4,
            opacity: isSelected ? 0.95 : 0.8
          });

          polyline.bindTooltip(
            `${job.rider_name} (${job.total_boxes} กล่อง, ${job.total_distance} กม.)`,
            { sticky: true }
          );

          this.layerGroup.addLayer(polyline);
        } else {
          // กรณี API ล้มเหลว ให้ใช้วาดเส้นตรงสำรอง
          this.drawFallbackPolyline(job, isSelected);
        }
      } catch (error) {
        console.warn('OSRM Route fetch failed, using fallback straight lines:', error);
        this.drawFallbackPolyline(job, isSelected);
      }
    }

    if (displayJobs.length > 0) {
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  private drawFallbackPolyline(job: DeliveryJob, isSelected: boolean): void {
    if (!this.layerGroup) return;
    const fallbackPoints: L.LatLngExpression[] = [
      [KITCHEN_LOCATION.lat, KITCHEN_LOCATION.lng],
      ...job.orders.map((o: any) => [o.delivery_lat, o.delivery_lng] as L.LatLngExpression)
    ];
    const polyline = L.polyline(fallbackPoints, {
      color: job.route_color,
      weight: isSelected ? 6 : 4,
      opacity: isSelected ? 0.95 : 0.75,
      dashArray: '6, 6'
    });
    this.layerGroup.addLayer(polyline);
  }
}