import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/catalog']);
    }
  }

  submit(): void {
    if (!this.username || !this.password) {
      this.errorMessage = 'Debes ingresar usuario y contraseña';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.auth.login(this.username.trim(), this.password).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/catalog']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error?.error?.error || 'Credenciales inválidas';
      }
    });
  }
}
