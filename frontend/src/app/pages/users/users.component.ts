import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UsersService, CreateUserPayload, UpdateUserPayload } from '../../services/users.service';
import { User, UserRole } from '../../models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  roleOptions: UserRole[] = ['admin', 'importer', 'viewer'];

  newUser: CreateUserPayload = {
    username: '',
    password: '',
    role: 'viewer',
    name: ''
  };

  selectedUser: User | null = null;
  editForm: UpdateUserPayload & { password?: string } = {
    username: '',
    name: '',
    role: 'viewer',
    password: ''
  };

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.usersService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.error || 'Error cargando usuarios';
        this.isLoading = false;
      }
    });
  }

  createUser(): void {
    if (!this.newUser.username || !this.newUser.password || !this.newUser.name) {
      this.errorMessage = 'Completa usuario, nombre y contraseña';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.usersService.createUser(this.newUser).subscribe({
      next: () => {
        this.successMessage = 'Usuario creado correctamente';
        this.newUser = { username: '', password: '', role: 'viewer', name: '' };
        this.loadUsers();
      },
      error: (error) => {
        this.errorMessage = error?.error?.error || 'No se pudo crear el usuario';
      }
    });
  }

  startEdit(user: User): void {
    this.selectedUser = user;
    this.editForm = {
      username: user.username,
      name: user.name,
      role: user.role,
      password: ''
    };
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelEdit(): void {
    this.selectedUser = null;
  }

  saveEdit(): void {
    if (!this.selectedUser) return;

    const payload: UpdateUserPayload = {
      username: this.editForm.username,
      name: this.editForm.name,
      role: this.editForm.role
    };

    if (this.editForm.password) {
      payload.password = this.editForm.password;
    }

    this.usersService.updateUser(this.selectedUser.id, payload).subscribe({
      next: () => {
        this.successMessage = 'Usuario actualizado correctamente';
        this.selectedUser = null;
        this.loadUsers();
      },
      error: (error) => {
        this.errorMessage = error?.error?.error || 'No se pudo actualizar el usuario';
      }
    });
  }
}
