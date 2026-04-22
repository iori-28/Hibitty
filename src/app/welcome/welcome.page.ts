import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

interface LocalProfile {
  displayName: string;
}

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonInput,
    IonItem,
    IonButton,
    IonNote,
    CommonModule,
    FormsModule,
  ],
})
export class WelcomePage implements OnInit {
  private readonly onboardingKey = 'hibitty.onboarding.completed.v1';
  private readonly profileKey = 'hibitty.profile.v1';

  displayName = '';
  formError = '';

  constructor(private readonly router: Router) { }

  ngOnInit() {
    if (this.hasCompletedOnboarding()) {
      void this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }

    this.loadExistingProfile();
  }

  async startTutorial(): Promise<void> {
    const isValid = this.persistProfile();
    if (!isValid) {
      return;
    }

    await this.router.navigateByUrl('/tutorial');
  }

  async exploreNow(): Promise<void> {
    const isValid = this.persistProfile();
    if (!isValid) {
      return;
    }

    localStorage.setItem(this.onboardingKey, 'true');
    await this.router.navigateByUrl('/home', { replaceUrl: true });
  }

  private loadExistingProfile(): void {
    const raw = localStorage.getItem(this.profileKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as LocalProfile;
      this.displayName = parsed.displayName ?? '';
    } catch {
      this.displayName = '';
    }
  }

  private persistProfile(): boolean {
    const trimmed = this.displayName.trim();
    if (!trimmed) {
      this.formError = 'Isi nama panggilan dulu ya sebelum lanjut.';
      return false;
    }

    this.formError = '';
    localStorage.setItem(
      this.profileKey,
      JSON.stringify({
        displayName: trimmed,
      }),
    );
    return true;
  }

  private hasCompletedOnboarding(): boolean {
    return localStorage.getItem(this.onboardingKey) === 'true';
  }

}
