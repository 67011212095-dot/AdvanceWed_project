import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { Customer } from '../models/customer.model';

const DEMO_CUSTOMERS: Customer[] = [
  { customer_id: 1, first_name: 'สมชาย', last_name: 'ใจดี (หอพักตักศิลา)', phone: '081-234-5678', latitude: 16.2492, longitude: 103.2541 },
  { customer_id: 2, first_name: 'วิภา', last_name: 'สดใส (หอพักอินเตอร์)', phone: '082-345-6789', latitude: 16.2435, longitude: 103.2502 },
  { customer_id: 3, first_name: 'กิตติศักดิ์', last_name: 'พัฒนา (คณะวิทยาการสารสนเทศ)', phone: '089-111-2233', latitude: 16.2451, longitude: 103.2560 },
  { customer_id: 4, first_name: 'ธนกร', last_name: 'สุขเกษม (คณะวิศวกรรมศาสตร์)', phone: '086-444-5566', latitude: 16.2478, longitude: 103.2485 },
  { customer_id: 5, first_name: 'นภาพร', last_name: 'ดารารัตน์ (อาคารราชนครินทร์)', phone: '084-555-6677', latitude: 16.2510, longitude: 103.2530 },
  { customer_id: 6, first_name: 'ปิยะวุฒิ', last_name: 'วงศ์ษา (หอพักเจริญสุข)', phone: '083-666-7788', latitude: 16.2420, longitude: 103.2575 },
  { customer_id: 7, first_name: 'สุพัตรา', last_name: 'มณีรัตน์ (หอพักร่มเย็น)', phone: '085-777-8899', latitude: 16.2405, longitude: 103.2490 },
  { customer_id: 8, first_name: 'ธีระวัฒน์', last_name: 'นาคราช (คณะพยาบาลศาสตร์)', phone: '087-888-9900', latitude: 16.2530, longitude: 103.2470 },
  { customer_id: 9, first_name: 'อนุชิต', last_name: 'แสนสุข (หอพักบ้านกัญจน์)', phone: '088-999-0011', latitude: 16.2480, longitude: 103.2600 },
  { customer_id: 10, first_name: 'รัตนาภรณ์', last_name: 'บุญมี (คอนโดเดอะแคปิตอล)', phone: '081-333-4455', latitude: 16.2440, longitude: 103.2450 },
  { customer_id: 11, first_name: 'ณรงค์ฤทธิ์', last_name: 'มีชัย (หอพักพูลสุข)', phone: '082-444-3322', latitude: 16.2505, longitude: 103.2580 },
  { customer_id: 12, first_name: 'ชลธิชา', last_name: 'ศิริผล (ศูนย์อาหารขามเรียง)', phone: '089-777-1234', latitude: 16.2415, longitude: 103.2525 }
];

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private apiUrl = 'http://localhost:3000/api/customers';
  private localCustomers: Customer[] = [...DEMO_CUSTOMERS];

  constructor(private http: HttpClient) {}

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.apiUrl).pipe(
      catchError(() => {
        return of(this.localCustomers);
      })
    );
  }

  searchByName(query: string): Observable<Customer[]> {
    const params = new HttpParams().set('name', query);
    return this.http.get<Customer[]>(`${this.apiUrl}/search`, { params }).pipe(
      catchError(() => {
        const lower = query.toLowerCase();
        const filtered = this.localCustomers.filter(
          (c) =>
            c.first_name.toLowerCase().includes(lower) ||
            c.last_name.toLowerCase().includes(lower)
        );
        return of(filtered);
      })
    );
  }

  searchNearby(lat: number, lng: number): Observable<Customer[]> {
    const params = new HttpParams()
      .set('lat', lat.toString())
      .set('lng', lng.toString())
      .set('distance', '1');
    return this.http.get<Customer[]>(`${this.apiUrl}/nearby`, { params }).pipe(
      catchError(() => {
        // Haversine fallback
        const filtered = this.localCustomers.filter((c) => {
          const R = 6371;
          const dLat = (c.latitude - lat) * (Math.PI / 180);
          const dLon = (c.longitude - lng) * (Math.PI / 180);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat * (Math.PI / 180)) *
              Math.cos(c.latitude * (Math.PI / 180)) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return dist <= 1;
        });
        return of(filtered);
      })
    );
  }

  addCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(this.apiUrl, customer).pipe(
      catchError(() => {
        const newCustomer = {
          ...customer,
          customer_id: this.localCustomers.length + 1
        };
        this.localCustomers.push(newCustomer);
        return of(newCustomer);
      })
    );
  }

  updateCustomer(id: number, customer: Customer): Observable<Customer> {
    return this.http.put<Customer>(`${this.apiUrl}/${id}`, customer).pipe(
      catchError(() => {
        const index = this.localCustomers.findIndex((c) => c.customer_id === id);
        if (index !== -1) {
          this.localCustomers[index] = { ...customer, customer_id: id };
        }
        return of(customer);
      })
    );
  }

  deleteCustomer(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      catchError(() => {
        this.localCustomers = this.localCustomers.filter((c) => c.customer_id !== id);
        return of({ message: 'Deleted locally' });
      })
    );
  }
}
