import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { CustomerService } from './customer';

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CustomerService, provideHttpClient()]
    });
    service = TestBed.inject(CustomerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
