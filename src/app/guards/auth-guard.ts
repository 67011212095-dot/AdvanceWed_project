import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);

  // ดึงค่า token และ role ที่เก็บไว้ตอน Login
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  const requiredRole = route.data?.['role'];

  // 1. ถ้ายังไม่ได้เข้าสู่ระบบ ให้เด้งกลับไปหน้า /login
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  // 2. ถ้าเป็น dispatch (เจ้าของร้าน/แอดมิน) ให้เข้าได้ทุกหน้า (ทั้ง /dispatch และ /rider)
  if (userRole === 'dispatch') {
    return true;
  }

  // 3. ถ้าเป็น rider แล้วพยายามเข้าหน้า dispatch ให้เด้งกลับไปหน้า /rider
  if (userRole === 'rider' && requiredRole === 'dispatch') {
    router.navigate(['/rider']);
    return false;
  }

  return true;
};