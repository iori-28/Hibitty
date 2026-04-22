import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

interface TutorialStep {
  title: string;
  description: string;
}

@Component({
  selector: 'app-tutorial',
  templateUrl: './tutorial.page.html',
  styleUrls: ['./tutorial.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    CommonModule,
    FormsModule,
  ],
})
export class TutorialPage implements OnInit {
  private readonly onboardingKey = 'hibitty.onboarding.completed.v1';

  readonly steps: TutorialStep[] = [
    {
      title: '1. Tambah Habit',
      description: 'Isi nama, kategori, dan jam habit lewat menu Add Habit.',
    },
    {
      title: '2. Ceklis Harian',
      description: 'Di Home, tap ceklis setiap habit yang sudah kamu jalankan hari ini.',
    },
    {
      title: '3. Lihat Tracker',
      description: 'Pantau tabel jurnal bulanan dan diagram monitoring progres kamu.',
    },
  ];

  currentStep = 0;

  constructor(private readonly router: Router) { }

  ngOnInit() {
  }

  nextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep += 1;
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep -= 1;
    }
  }

  async finishTutorial(): Promise<void> {
    localStorage.setItem(this.onboardingKey, 'true');
    await this.router.navigateByUrl('/home', { replaceUrl: true });
  }

}
