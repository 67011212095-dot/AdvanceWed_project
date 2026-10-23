import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DispatchService, KITCHEN_LOCATION } from '../services/dispatch.service';
import { DeliveryJob } from '../models/delivery-job.model';
import { Order } from '../models/order.model';

@Component({
  selector: 'app-rider-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rider-view.html',
  styleUrl: './rider-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RiderView implements OnInit {
  readonly dispatchService = inject(DispatchService);

  @Input() initialJobId: number | null = null;

  searchJobInput: string = '';
  currentJob = signal<DeliveryJob | null>(null);
  kitchenLocation = KITCHEN_LOCATION;

  ngOnInit(): void {
    const jobs = this.dispatchService.deliveryJobs();
    if (this.initialJobId) {
      this.searchJobInput = this.initialJobId.toString();
      this.lookupJob(this.initialJobId);
    } else if (jobs.length > 0) {
      this.searchJobInput = jobs[0].job_id.toString();
      this.lookupJob(jobs[0].job_id);
    }
  }

  lookupJob(jobIdNumber?: number): void {
    const id = jobIdNumber || parseInt(this.searchJobInput.trim(), 10);
    if (isNaN(id)) return;

    const job = this.dispatchService.getJobById(id);
    this.currentJob.set(job || null);
  }

  selectJob(job: DeliveryJob): void {
    this.searchJobInput = job.job_id.toString();
    this.currentJob.set(job);
  }

  getGoogleMapsUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  markDelivered(order: Order): void {
    const job = this.currentJob();
    if (!job || !order.order_id) return;
    this.dispatchService.updateOrderStatus(job.job_id, order.order_id, 'delivered');
    this.lookupJob(job.job_id);
  }

  getCompletedStopsCount(): number {
    const job = this.currentJob();
    if (!job) return 0;
    return job.orders.filter((o) => o.order_status === 'delivered').length;
  }
}
