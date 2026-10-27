import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
})
export class Login {
  mode: 'login' | 'register' = 'login';

  username = '';
  password = '';
  confirmPassword = '';
  fullName = '';
  role: 'dispatch' | 'rider' = 'dispatch';

  error = '';
  success = '';
  loading = false;
  showPassword = false;

  constructor(private auth: Auth, private router: Router) {}

  switchMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.error = '';
    this.success = '';
    this.password = '';
    this.confirmPassword = '';
  }

  onSubmit(): void {
    if (this.loading) return;
    this.error = '';
    this.success = '';

    if (this.mode === 'register') {
      this.register();
    } else {
      this.login();
    }
  }

  private login(): void {
  this.loading = true;
  this.auth.login(this.username.trim(), this.password).subscribe({
    next: (res) => {
      this.loading = false;
      
      // บันทึก Token และ Role เข้า LocalStorage
      localStorage.setItem('token', res.token);
      localStorage.setItem('role', res.role);

      this.router.navigate([res.role === 'rider' ? '/rider' : '/dispatch']);
    },
    error: () => {
      this.loading = false;
      this.error = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    },
  });
}

  private register(): void {
    if (this.password.length < 4) {
      this.error = 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
      return;
    }

    this.loading = true;
    this.auth
      .register({
        username: this.username.trim(),
        password: this.password,
        fullName: this.fullName.trim(),
        role: this.role,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          const user = this.username;
          this.switchMode('login');
          this.username = user;
          this.success = 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ';
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.message || 'สมัครสมาชิกไม่สำเร็จ ชื่อผู้ใช้นี้อาจถูกใช้แล้ว';
        },
      });
  }
}