import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  // หน้าหลักยังสลับด้วย app.html เดิม route พวกนี้มีไว้ให้ URL กับ guard ทำงาน
  { path: 'dispatch', canActivate: [authGuard], children: [] },
  { path: 'rider', canActivate: [authGuard], children: [] },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];