import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, tap } from 'rxjs';

interface LoginResponse {
  token: string;
  role: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  fullName: string;
  role: 'dispatch' | 'rider';
}

interface MockUser extends RegisterPayload { }


const USE_MOCK = false;
const MOCK_USERS_KEY = 'mock_users';

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = 'https://advancewed-project.onrender.com/api';

  constructor(private http: HttpClient) { }

  // ---------- Login ----------
  login(username: string, password: string): Observable<LoginResponse> {
    const request$: Observable<LoginResponse> = USE_MOCK
      ? this.mockLogin(username, password)
      : this.http.post<LoginResponse>(`${this.api}/login`, { username, password });

    return request$.pipe(
      tap((res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('role', res.role);
      })
    );
  }

  // ---------- Register ----------
  register(payload: RegisterPayload): Observable<unknown> {
    return USE_MOCK
      ? this.mockRegister(payload)
      : this.http.post(`${this.api}/register`, payload);
  }

  // src/app/services/auth.ts

  logout(): void {
    localStorage.clear(); // ล้างข้อมูลการเข้าสู่ระบบทั้งหมด (ทั้ง token และ role)
  }

  get isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  get role(): string | null {
    return localStorage.getItem('role');
  }

  // ---------- Mock (ใช้ตอนยังไม่มี backend) ----------
  private getMockUsers(): MockUser[] {
    try {
      return JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private mockLogin(username: string, password: string): Observable<LoginResponse> {
    // บัญชีทดลองที่ใช้ได้เสมอ
    if (username === 'admin' || username === 'rider') {
      return of({ token: 'mock-token', role: username === 'rider' ? 'rider' : 'dispatch' });
    }
    const user = this.getMockUsers().find(
      (u) => u.username === username && u.password === password
    );
    return user
      ? of({ token: 'mock-token', role: user.role })
      : throwError(() => new Error('invalid credentials'));
  }

  private mockRegister(payload: RegisterPayload): Observable<unknown> {
    const users = this.getMockUsers();
    const reserved = ['admin', 'rider'];
    if (reserved.includes(payload.username) || users.some((u) => u.username === payload.username)) {
      return throwError(() => new Error('ชื่อผู้ใช้นี้ถูกใช้แล้ว'));
    }
    users.push(payload);
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
    return of({ ok: true });
  }
}