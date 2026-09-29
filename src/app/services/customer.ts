import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Customer } from '../models/customer.model';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  // เปลี่ยน port ให้ตรงกับเพื่อนที่ทำ Backend 
    private apiUrl = 'http://localhost:3000/api/customers';

    constructor(private http: HttpClient){

    }

    // แสดงลูกค้าทั้งหมด
    getCustomers(): Observable<Customer[]>
    {
        return this.http.get<Customer[]>(this.apiUrl);
    }

    // ค้นหาตามส่วนหนึ่งของชื่อ หรือนามสกุล
    searchByName(query: string): Observable<Customer[]>
    {
        const params = new HttpParams().set('name', query);
        return this.http.get<Customer[]>(`${this.apiUrl}/search`, { params });
    }

    // ค้นหาลูกค้าในระยะ 1 กิโลเมตรจากพิกัด
    searchNearby(lat: number, lng: number): Observable<Customer[]>
    {
        const params = new HttpParams()
            .set('lat', lat.toString())
            .set('lng', lng.toString())
            .set('distance', '1');
        return this.http.get<Customer[]>(`${this.apiUrl}/nearby`, { params });
    }

    // เพิ่มลูกค้า
    addCustomer(customer: Customer): Observable<Customer>
    {
        return this.http.post<Customer>(this.apiUrl, customer);
    }

    // แก้ไขข้อมูลลูกค้า
    updateCustomer(id: number, customer: Customer): Observable<Customer>
    {
        return this.http.put<Customer>(`${this.apiUrl}/${id}`, customer);
    }

    // ลบลูกค้า
    deleteCustomer(id: number): Observable<any>
    {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }
}
