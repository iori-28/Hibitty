import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCheckbox,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  alarmOutline,
  checkmarkCircleOutline,
  createOutline,
  flameOutline,
  statsChartOutline,
  trashOutline,
  trophyOutline,
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

type HabitMode = 'casual' | 'important';

interface Habit {
  id: string;
  name: string;
  category: string;
  mode: HabitMode;
  reminderTime: string | null;
  history: string[];
  currentStreak: number;
  bestStreak: number;
  streakShield: number;
  lastGraceDate: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonChip,
    IonBadge,
    IonCheckbox,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSegment,
    IonSegmentButton,
    IonNote,
  ],
})
export class HomePage {
  private readonly storageKey = 'hibitty.habits.v1';
  readonly categoryOptions = [
    'Belajar',
    'Kerja',
    'Olahraga',
    'Kesehatan',
    'Hobi',
    'Main',
    'Spiritual',
    'Lainnya',
  ];

  habits: Habit[] = [];
  showForm = false;
  editingHabitId: string | null = null;
  draftName = '';
  draftCategory = this.categoryOptions[0];
  draftMode: HabitMode = 'casual';
  draftReminderTime = '20:00';

  constructor() {
    addIcons({
      flameOutline,
      trophyOutline,
      statsChartOutline,
      addCircleOutline,
      createOutline,
      trashOutline,
      checkmarkCircleOutline,
      alarmOutline,
    });
    this.loadHabits();
    void this.initNotifications();
  }

  get totalHabits(): number {
    return this.habits.length;
  }

  get completedTodayCount(): number {
    const today = this.todayKey();
    return this.habits.filter((habit) => habit.history.includes(today)).length;
  }

  get completionRateToday(): number {
    if (!this.totalHabits) {
      return 0;
    }

    return Math.round((this.completedTodayCount / this.totalHabits) * 100);
  }

  get completionRate7Days(): number {
    if (!this.totalHabits) {
      return 0;
    }

    const last7 = this.getLastDays(7);
    const completedSlots = this.habits.reduce((acc, habit) => {
      const doneInWindow = habit.history.filter((date) => last7.includes(date)).length;
      return acc + doneInWindow;
    }, 0);
    const totalSlots = this.totalHabits * last7.length;

    return Math.round((completedSlots / totalSlots) * 100);
  }

  get bestOverallStreak(): number {
    if (!this.habits.length) {
      return 0;
    }

    return Math.max(...this.habits.map((habit) => habit.bestStreak));
  }

  get focusCompletionRate(): number {
    const focusHabits = this.habits.filter((habit) => habit.mode === 'important');
    if (!focusHabits.length) {
      return 0;
    }

    const done = focusHabits.filter((habit) => this.isDoneToday(habit)).length;
    return Math.round((done / focusHabits.length) * 100);
  }

  get procrastinationRiskLabel(): 'Low' | 'Medium' | 'High' {
    const focusHabits = this.habits.filter((habit) => habit.mode === 'important');
    if (!focusHabits.length) {
      return 'Low';
    }

    let hasMedium = false;
    for (const habit of focusHabits) {
      const risk = this.getRiskLevel(habit);
      if (risk === 'high') {
        return 'High';
      }
      if (risk === 'medium') {
        hasMedium = true;
      }
    }

    return hasMedium ? 'Medium' : 'Low';
  }

  toggleForm(): void {
    this.showForm = !this.showForm;

    if (!this.showForm) {
      this.resetDraft();
    }
  }

  startCreateHabit(): void {
    this.editingHabitId = null;
    this.showForm = true;
    this.resetDraft();
  }

  startEditHabit(habit: Habit): void {
    this.editingHabitId = habit.id;
    this.showForm = true;
    this.draftName = habit.name;
    this.draftCategory = habit.category;
    this.draftMode = habit.mode;
    this.draftReminderTime = habit.reminderTime ?? '20:00';
  }

  saveHabit(): void {
    const trimmedName = this.draftName.trim();
    if (!trimmedName) {
      return;
    }

    if (this.editingHabitId) {
      const target = this.habits.find((habit) => habit.id === this.editingHabitId);
      if (!target) {
        return;
      }

      target.name = trimmedName;
      target.category = this.draftCategory;
      target.mode = this.draftMode;
      target.reminderTime = this.draftReminderTime || null;
    } else {
      this.habits.push({
        id: this.createId(),
        name: trimmedName,
        category: this.draftCategory,
        mode: this.draftMode,
        reminderTime: this.draftReminderTime || null,
        history: [],
        currentStreak: 0,
        bestStreak: 0,
        streakShield: this.draftMode === 'important' ? 1 : 0,
        lastGraceDate: null,
        createdAt: new Date().toISOString(),
      });
    }

    this.sortHabits();
    this.persistHabits();
    this.showForm = false;
    this.resetDraft();
  }

  deleteHabit(habit: Habit): void {
    const canDelete = window.confirm(`Hapus habit "${habit.name}"?`);
    if (!canDelete) {
      return;
    }

    this.habits = this.habits.filter((item) => item.id !== habit.id);
    this.persistHabits();
  }

  onCheckIn(habit: Habit, checked: boolean): void {
    if (!checked || this.isDoneToday(habit)) {
      return;
    }

    const today = this.todayKey();
    const previousDate = this.getLatestHistoryDate(habit);

    habit.history = [...habit.history, today].sort();

    if (!previousDate) {
      habit.currentStreak = 1;
    } else {
      const gap = this.daysBetween(previousDate, today);

      if (gap === 1) {
        habit.currentStreak += 1;
      } else if (habit.mode === 'important' && gap === 2 && habit.streakShield > 0) {
        habit.currentStreak += 1;
        habit.streakShield -= 1;
      } else if (habit.mode === 'casual' && gap === 2 && this.canUseCasualGrace(habit, today)) {
        habit.currentStreak += 1;
        habit.lastGraceDate = today;
      } else {
        habit.currentStreak = 1;
      }
    }

    habit.bestStreak = Math.max(habit.bestStreak, habit.currentStreak);
    this.persistHabits();
  }

  isDoneToday(habit: Habit): boolean {
    return habit.history.includes(this.todayKey());
  }

  getModeLabel(mode: HabitMode): string {
    return mode === 'important' ? 'Fokus' : 'Santai';
  }

  getModeColor(mode: HabitMode): string {
    return mode === 'important' ? 'danger' : 'medium';
  }

  getRiskLevel(habit: Habit): 'low' | 'medium' | 'high' {
    if (habit.mode !== 'important') {
      return 'low';
    }

    const latest = this.getLatestHistoryDate(habit);
    if (!latest) {
      return 'high';
    }

    const days = this.daysBetween(latest, this.todayKey());
    if (days >= 3) {
      return 'high';
    }
    if (days === 2) {
      return 'medium';
    }

    return 'low';
  }

  getRiskLabel(habit: Habit): string {
    const risk = this.getRiskLevel(habit);
    if (risk === 'high') {
      return 'Risk: Tinggi';
    }
    if (risk === 'medium') {
      return 'Risk: Sedang';
    }
    return 'Risk: Rendah';
  }

  getRescuePrompt(habit: Habit): string {
    if (habit.mode !== 'important' || this.isDoneToday(habit)) {
      return '';
    }

    const risk = this.getRiskLevel(habit);
    if (risk === 'high') {
      return 'Mulai 2 menit dulu sekarang, lalu lanjut 1 langkah kecil.';
    }
    if (risk === 'medium') {
      return 'Lakukan versi mini hari ini supaya streak tetap hidup.';
    }
    return 'Kamu masih aman. Tetap check-in hari ini biar konsisten.';
  }

  shouldShowReminder(habit: Habit): boolean {
    if (!habit.reminderTime || this.isDoneToday(habit)) {
      return false;
    }

    const [hours, minutes] = habit.reminderTime.split(':').map(Number);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const reminderMinutes = hours * 60 + minutes;

    return nowMinutes >= reminderMinutes;
  }

  trackByHabit(_: number, habit: Habit): string {
    return habit.id;
  }

  private canUseCasualGrace(habit: Habit, today: string): boolean {
    if (!habit.lastGraceDate) {
      return true;
    }

    return this.daysBetween(habit.lastGraceDate, today) >= 7;
  }

  private loadHabits(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Habit[];
      this.habits = parsed.map((habit) => ({
        ...habit,
        reminderTime: habit.reminderTime ?? null,
        history: [...(habit.history ?? [])].sort(),
        currentStreak: habit.currentStreak ?? 0,
        bestStreak: habit.bestStreak ?? 0,
        streakShield: habit.streakShield ?? (habit.mode === 'important' ? 1 : 0),
        lastGraceDate: habit.lastGraceDate ?? null,
      }));
      this.sortHabits();
    } catch {
      this.habits = [];
    }
  }

  private persistHabits(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.habits));
    void this.syncLocalNotifications();
  }

  private sortHabits(): void {
    this.habits = [...this.habits].sort((a, b) => {
      if (a.mode !== b.mode) {
        return a.mode === 'important' ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
  }

  private resetDraft(): void {
    this.draftName = '';
    this.draftCategory = this.categoryOptions[0];
    this.draftMode = 'casual';
    this.draftReminderTime = '20:00';
    this.editingHabitId = null;
  }

  private getLatestHistoryDate(habit: Habit): string | null {
    if (!habit.history.length) {
      return null;
    }

    return habit.history[habit.history.length - 1];
  }

  private getLastDays(totalDays: number): string[] {
    const days: string[] = [];
    const now = new Date();
    for (let i = 0; i < totalDays; i += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      days.push(this.toDayKey(date));
    }
    return days;
  }

  private todayKey(): string {
    return this.toDayKey(new Date());
  }

  private toDayKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private daysBetween(from: string, to: string): number {
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    const diffMs = toDate.getTime() - fromDate.getTime();
    return Math.round(diffMs / 86400000);
  }

  private createId(): string {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  private async initNotifications(): Promise<void> {
    if (!this.isNativePlatform()) {
      return;
    }

    try {
      const permissions = await LocalNotifications.checkPermissions();
      if (permissions.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      await this.syncLocalNotifications();
    } catch {
      // Ignore notification initialization errors and keep app usable.
    }
  }

  private async syncLocalNotifications(): Promise<void> {
    if (!this.isNativePlatform()) {
      return;
    }

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((notification) => ({ id: notification.id })),
        });
      }

      const notifications = this.habits
        .filter((habit) => !!habit.reminderTime)
        .map((habit) => {
          const [hour, minute] = (habit.reminderTime ?? '20:00').split(':').map(Number);
          return {
            id: this.notificationIdFromHabit(habit.id),
            title: 'Hibitty Reminder',
            body: `${habit.name} (${this.getModeLabel(habit.mode)}) - waktunya check-in hari ini.`,
            schedule: {
              on: {
                hour,
                minute,
              },
              repeats: true,
            },
          };
        });

      if (notifications.length) {
        await LocalNotifications.schedule({ notifications });
      }
    } catch {
      // Ignore scheduling errors for unsupported environments.
    }
  }

  private notificationIdFromHabit(habitId: string): number {
    let hash = 0;
    for (let i = 0; i < habitId.length; i += 1) {
      hash = (hash * 31 + habitId.charCodeAt(i)) | 0;
    }

    return Math.abs(hash) || 1;
  }

  private isNativePlatform(): boolean {
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android';
  }

}
