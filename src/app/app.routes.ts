import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { Login } from './auth/login/login';
import { DispatchConsole } from './dispatch/dispatch-console';
import { RiderView } from './rider/rider-view';

export const routes: Routes = [
  { 
    path: 'login', 
    component: Login 
  },
  { 
    path: 'dispatch', 
    component: DispatchConsole, 
    canActivate: [authGuard], 
    data: { role: 'dispatch' } // เฉพาะแอดมิน/เจ้าของร้านเท่านั้น
  },
  { 
    path: 'rider', 
    component: RiderView, 
    canActivate: [authGuard] // ได้ทั้งแอดมินและไรเดอร์
  },
  { 
    path: '', 
    redirectTo: 'login', 
    pathMatch: 'full' 
  },
  { 
    path: '**', 
    redirectTo: 'login' 
  }
];