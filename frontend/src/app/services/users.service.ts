import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, UserRole } from '../models/user.model';

export interface CreateUserPayload {
  username: string;
  password: string;
  role: UserRole;
  name: string;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  role?: UserRole;
  name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  createUser(payload: CreateUserPayload): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.apiUrl}/users`, payload);
  }

  updateUser(id: number, payload: UpdateUserPayload): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.apiUrl}/users/${id}`, payload);
  }
}
