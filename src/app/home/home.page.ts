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
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
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
    homeOutline,
    statsChartOutline,
    trashOutline,
    trophyOutline,
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

type MenuTab = 'home' | 'add' | 'tracker';

interface Habit {
    id: string;
    name: string;
    category: string;
    reminderTime: string | null;
    history: string[];
    checkInTimes: Record<string, string>;
    currentStreak: number;
    bestStreak: number;
    createdAt: string;
}

interface LocalProfile {
    displayName: string;
}

interface DayCell {
    day: number;
    key: string;
}

interface MonthlyBarData {
    id: string;
    name: string;
    shortLabel: string;
    count: number;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    topX: number;
    topY: number;
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
        IonFooter,
        IonCard,
        IonCardHeader,
        IonCardTitle,
        IonCardSubtitle,
        IonCardContent,
        IonButton,
        IonIcon,
        IonItem,
        IonLabel,
        IonChip,
        IonBadge,
        IonCheckbox,
        IonInput,
        IonSelect,
        IonSelectOption,
    ],
})
export class HomePage {
    private readonly storageKey = 'hibitty.habits.v2';
    private readonly profileKey = 'hibitty.profile.v1';
    private readonly monthlyChartMinWidth = 360;
    private readonly monthlyChartHeight = 190;
    private notificationPermissionGranted = false;

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
    activeTab: MenuTab = 'home';
    editingHabitId: string | null = null;

    draftName = '';
    draftCategory = this.categoryOptions[0];
    draftReminderTime = '00:00';
    formError = '';

    selectedMonth = this.toMonthKey(new Date());
    selectedYear = new Date().getFullYear();
    selectedYearlyHabitId: string | null = null;
    selectedMonthlyBarId: string | null = null;
    displayName = 'Teman';
    draftDisplayName = '';
    isEditingDisplayName = false;
    profileError = '';
    notificationInfo = '';

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
            homeOutline,
        });

        this.loadProfile();
        this.loadHabits();
        this.syncFiltersWithData();
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

    get monthCompletionRate(): number {
        const monthDays = this.daysInSelectedMonth.length;
        if (!this.totalHabits || !monthDays) {
            return 0;
        }

        const monthTotal = this.habits.reduce((acc, habit) => acc + this.getMonthCount(habit, this.selectedMonth), 0);
        const slots = this.totalHabits * monthDays;

        return Math.round((monthTotal / slots) * 100);
    }

    get bestOverallStreak(): number {
        if (!this.habits.length) {
            return 0;
        }

        return Math.max(...this.habits.map((habit) => habit.bestStreak));
    }

    get currentStreakSummary(): number {
        const days = this.getGlobalCheckinDays();
        if (!days.length) {
            return 0;
        }

        const latest = days[days.length - 1];
        if (this.daysBetween(latest, this.todayKey()) > 1) {
            return 0;
        }

        let current = 1;
        for (let i = days.length - 1; i > 0; i -= 1) {
            const gap = this.daysBetween(days[i - 1], days[i]);
            if (gap === 1) {
                current += 1;
            } else {
                break;
            }
        }

        return current;
    }

    get dueReminderHabits(): Habit[] {
        return this.habits.filter((habit) => this.shouldShowReminder(habit));
    }

    get monthOptions(): string[] {
        const currentMonth = this.toMonthKey(new Date());
        let earliestMonth = currentMonth;

        for (const habit of this.habits) {
            const createdMonth = this.toMonthKey(new Date(habit.createdAt));
            if (createdMonth < earliestMonth) {
                earliestMonth = createdMonth;
            }

            for (const dateKey of habit.history) {
                const historyMonth = dateKey.slice(0, 7);
                if (historyMonth < earliestMonth) {
                    earliestMonth = historyMonth;
                }
            }
        }

        const options: string[] = [];
        let cursor = earliestMonth;
        while (cursor <= currentMonth) {
            options.push(cursor);
            cursor = this.nextMonthKey(cursor);
        }

        return options.sort((a, b) => b.localeCompare(a));
    }

    get yearOptions(): number[] {
        const set = new Set<number>();
        const currentYear = new Date().getFullYear();
        set.add(currentYear);

        for (const habit of this.habits) {
            for (const dateKey of habit.history) {
                set.add(Number(dateKey.slice(0, 4)));
            }
        }

        return [...set].sort((a, b) => b - a);
    }

    get daysInSelectedMonth(): DayCell[] {
        const [yearStr, monthStr] = this.selectedMonth.split('-');
        const year = Number(yearStr);
        const monthIndex = Number(monthStr) - 1;
        const maxDay = new Date(year, monthIndex + 1, 0).getDate();
        const days: DayCell[] = [];

        for (let day = 1; day <= maxDay; day += 1) {
            const date = new Date(year, monthIndex, day);
            days.push({ day, key: this.toDayKey(date) });
        }

        return days;
    }

    get selectedMonthLabel(): string {
        const [yearStr, monthStr] = this.selectedMonth.split('-');
        const month = Number(monthStr);
        const year = Number(yearStr);
        const date = new Date(year, month - 1, 1);

        return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
    }

    get monthlyLinePoints(): string {
        const counts = this.habits.map((habit) => this.getMonthCount(habit, this.selectedMonth));
        return this.toPolylinePoints(counts, Math.max(...this.daysInSelectedMonth.map((d) => d.day), 1));
    }

    get monthlyBarData(): MonthlyBarData[] {
        if (!this.habits.length) {
            return [];
        }

        const counts = this.habits.map((habit) => this.getMonthCount(habit, this.selectedMonth));
        const maxY = Math.max(...counts, 1);
        const width = this.monthlyChartWidth;
        const height = this.monthlyChartHeight;
        const xPad = 22;
        const yPad = 18;
        const chartWidth = width - xPad * 2;
        const chartHeight = height - yPad * 2;
        const slot = chartWidth / this.habits.length;
        const barWidth = Math.min(26, Math.max(12, slot * 0.55));

        return this.habits.map((habit, index) => {
            const count = counts[index];
            const centerX = xPad + index * slot + slot / 2;
            const barHeight = (count / maxY) * chartHeight;
            const x = centerX - barWidth / 2;
            const y = yPad + chartHeight - barHeight;

            return {
                id: habit.id,
                name: habit.name,
                shortLabel: this.toShortLabel(habit.name),
                count,
                color: this.getCategoryAccent(habit.category),
                x,
                y,
                width: barWidth,
                height: barHeight,
                topX: centerX,
                topY: y,
            };
        });
    }

    get monthlyTrendPoints(): string {
        if (!this.monthlyBarData.length) {
            return '';
        }

        return this.monthlyBarData.map((bar) => `${bar.topX.toFixed(1)},${bar.topY.toFixed(1)}`).join(' ');
    }

    get monthlyChartWidth(): number {
        return Math.max(this.monthlyChartMinWidth, this.habits.length * 52);
    }

    get monthlyChartViewBox(): string {
        return `0 0 ${this.monthlyChartWidth} ${this.monthlyChartHeight}`;
    }

    get shouldEnableChartScroll(): boolean {
        return this.habits.length > 10;
    }

    get selectedMonthlyBarLabel(): string {
        if (!this.selectedMonthlyBarId) {
            return '';
        }

        const bar = this.monthlyBarData.find((item) => item.id === this.selectedMonthlyBarId);
        if (!bar) {
            return '';
        }

        return `${bar.name}: ${bar.count} ceklis di ${this.selectedMonthLabel}`;
    }

    get monthlyPointLabels(): string[] {
        return this.habits.map((habit) => `${habit.name}: ${this.getMonthCount(habit, this.selectedMonth)}`);
    }

    get selectedYearlyHabitName(): string {
        if (!this.selectedYearlyHabitId) {
            return '-';
        }

        const habit = this.habits.find((item) => item.id === this.selectedYearlyHabitId);
        return habit?.name ?? '-';
    }

    get yearlyLinePoints(): string {
        if (!this.selectedYearlyHabitId) {
            return '';
        }

        const counts = this.getYearlyCounts(this.selectedYearlyHabitId, this.selectedYear);
        return this.toPolylinePoints(counts, 31);
    }

    get yearlyPointLabels(): string[] {
        if (!this.selectedYearlyHabitId) {
            return [];
        }

        const counts = this.getYearlyCounts(this.selectedYearlyHabitId, this.selectedYear);
        return counts.map((count, index) => `Bulan ${index + 1}: ${count}`);
    }

    setTab(tab: MenuTab): void {
        this.activeTab = tab;
        this.formError = '';

        if (tab === 'add' && !this.editingHabitId) {
            this.resetDraft();
        }
    }

    startCreateHabit(): void {
        this.editingHabitId = null;
        this.formError = '';
        this.resetDraft();
        this.activeTab = 'add';
    }

    startEditHabit(habit: Habit): void {
        this.editingHabitId = habit.id;
        this.formError = '';
        this.draftName = habit.name;
        this.draftCategory = habit.category;
        this.draftReminderTime = habit.reminderTime ?? '00:00';
        this.activeTab = 'add';
    }

    saveHabit(): void {
        const trimmedName = this.draftName.trim();
        if (!trimmedName) {
            this.formError = 'Nama habit wajib diisi sebelum disimpan.';
            return;
        }

        if (this.isDuplicateHabitName(trimmedName)) {
            this.formError = 'Nama habit sudah ada. Coba nama lain supaya tidak dobel.';
            return;
        }

        this.formError = '';

        if (this.editingHabitId) {
            const target = this.habits.find((habit) => habit.id === this.editingHabitId);
            if (!target) {
                return;
            }

            target.name = trimmedName;
            target.category = this.draftCategory;
            target.reminderTime = this.draftReminderTime || null;
        } else {
            this.habits.push({
                id: this.createId(),
                name: trimmedName,
                category: this.draftCategory,
                reminderTime: this.draftReminderTime || null,
                history: [],
                checkInTimes: {},
                currentStreak: 0,
                bestStreak: 0,
                createdAt: new Date().toISOString(),
            });
        }

        this.sortHabits();
        this.persistHabits();
        this.syncFiltersWithData();
        this.editingHabitId = null;
        this.resetDraft();
        this.activeTab = 'home';
    }

    cancelAddHabit(): void {
        this.editingHabitId = null;
        this.formError = '';
        this.resetDraft();
        this.activeTab = 'home';
    }

    deleteHabit(habit: Habit): void {
        const canDelete = window.confirm(`Hapus habit "${habit.name}"?`);
        if (!canDelete) {
            return;
        }

        this.habits = this.habits.filter((item) => item.id !== habit.id);
        this.persistHabits();
        this.syncFiltersWithData();
    }

    onCheckIn(habit: Habit, checked: boolean): void {
        if (!checked || this.isDoneToday(habit)) {
            return;
        }

        const today = this.todayKey();
        habit.history = [...habit.history, today].sort();
        habit.checkInTimes[today] = new Date().toISOString();
        this.recalculateStreak(habit);
        this.persistHabits();
    }

    isDoneToday(habit: Habit): boolean {
        return habit.history.includes(this.todayKey());
    }

    isDoneOnDate(habit: Habit, dateKey: string): boolean {
        return habit.history.includes(dateKey);
    }

    getMonthCount(habit: Habit, monthKey: string): number {
        return habit.history.filter((dateKey) => dateKey.startsWith(monthKey)).length;
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

    isMissedTargetTime(habit: Habit): boolean {
        if (!habit.reminderTime || this.isDoneToday(habit)) {
            return false;
        }

        const [hours, minutes] = habit.reminderTime.split(':').map(Number);
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const reminderMinutes = hours * 60 + minutes;

        return nowMinutes > reminderMinutes;
    }

    getTodayCheckinTimeLabel(habit: Habit): string {
        const timestamp = habit.checkInTimes[this.todayKey()];
        if (!timestamp) {
            return '';
        }

        return new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(timestamp));
    }

    getActiveStreak(habit: Habit): number {
        if (!habit.history.length) {
            return 0;
        }

        const latest = habit.history[habit.history.length - 1];
        const gap = this.daysBetween(latest, this.todayKey());
        return gap <= 1 ? habit.currentStreak : 0;
    }

    getCategoryAccent(category: string): string {
        const map: Record<string, string> = {
            Belajar: '#8a5a44',
            Kerja: '#6b7b4f',
            Olahraga: '#c06b4b',
            Kesehatan: '#4d8f7a',
            Hobi: '#9b6d84',
            Main: '#6a78a9',
            Spiritual: '#8f7a4d',
            Lainnya: '#6f6258',
        };

        return map[category] ?? map['Lainnya'];
    }

    trackByHabit(_: number, habit: Habit): string {
        return habit.id;
    }

    trackByMonthlyBar(_: number, bar: MonthlyBarData): string {
        return bar.id;
    }

    onSelectMonthlyBar(barId: string): void {
        this.selectedMonthlyBarId = this.selectedMonthlyBarId === barId ? null : barId;
    }

    startEditDisplayName(): void {
        this.isEditingDisplayName = true;
        this.draftDisplayName = this.displayName;
        this.profileError = '';
    }

    cancelEditDisplayName(): void {
        this.isEditingDisplayName = false;
        this.draftDisplayName = this.displayName;
        this.profileError = '';
    }

    saveDisplayName(): void {
        const trimmed = this.draftDisplayName.trim();
        if (!trimmed) {
            this.profileError = 'Nama panggilan tidak boleh kosong.';
            return;
        }

        this.displayName = trimmed;
        this.isEditingDisplayName = false;
        this.profileError = '';
        localStorage.setItem(
            this.profileKey,
            JSON.stringify({
                displayName: trimmed,
            }),
        );
    }

    private syncFiltersWithData(): void {
        const months = this.monthOptions;
        if (!months.includes(this.selectedMonth)) {
            this.selectedMonth = months[0];
        }

        const years = this.yearOptions;
        if (!years.includes(this.selectedYear)) {
            this.selectedYear = years[0];
        }

        if (!this.selectedYearlyHabitId || !this.habits.find((habit) => habit.id === this.selectedYearlyHabitId)) {
            this.selectedYearlyHabitId = this.habits[0]?.id ?? null;
        }
    }

    private loadHabits(): void {
        const raw = localStorage.getItem(this.storageKey) ?? localStorage.getItem('hibitty.habits.v1');
        if (!raw) {
            return;
        }

        try {
            const parsed = JSON.parse(raw) as Array<Habit & { mode?: string; streakShield?: number; lastGraceDate?: string | null }>;
            this.habits = parsed.map((habit) => {
                const normalized: Habit = {
                    id: habit.id,
                    name: habit.name,
                    category: habit.category ?? 'Lainnya',
                    reminderTime: habit.reminderTime ?? null,
                    history: [...(habit.history ?? [])].sort(),
                    checkInTimes: { ...(habit.checkInTimes ?? {}) },
                    currentStreak: habit.currentStreak ?? 0,
                    bestStreak: habit.bestStreak ?? 0,
                    createdAt: habit.createdAt ?? new Date().toISOString(),
                };

                this.recalculateStreak(normalized);
                return normalized;
            });

            this.sortHabits();
            localStorage.removeItem('hibitty.habits.v1');
            this.persistHabits();
        } catch {
            this.habits = [];
        }
    }

    private loadProfile(): void {
        const raw = localStorage.getItem(this.profileKey);
        if (!raw) {
            this.displayName = 'Teman';
            this.draftDisplayName = this.displayName;
            return;
        }

        try {
            const parsed = JSON.parse(raw) as LocalProfile;
            const trimmed = parsed.displayName?.trim();
            this.displayName = trimmed || 'Teman';
        } catch {
            this.displayName = 'Teman';
        }

        this.draftDisplayName = this.displayName;
    }

    private getGlobalCheckinDays(): string[] {
        const set = new Set<string>();
        for (const habit of this.habits) {
            for (const day of habit.history) {
                set.add(day);
            }
        }

        return [...set].sort();
    }

    private persistHabits(): void {
        localStorage.setItem(this.storageKey, JSON.stringify(this.habits));
        void this.syncLocalNotifications();
    }

    private recalculateStreak(habit: Habit): void {
        if (!habit.history.length) {
            habit.currentStreak = 0;
            habit.bestStreak = 0;
            return;
        }

        const uniqueDays = [...new Set(habit.history)].sort();
        habit.history = uniqueDays;

        let best = 1;
        let running = 1;

        for (let i = 1; i < uniqueDays.length; i += 1) {
            const gap = this.daysBetween(uniqueDays[i - 1], uniqueDays[i]);
            if (gap === 1) {
                running += 1;
            } else {
                running = 1;
            }
            best = Math.max(best, running);
        }

        let current = 1;
        for (let i = uniqueDays.length - 1; i > 0; i -= 1) {
            const gap = this.daysBetween(uniqueDays[i - 1], uniqueDays[i]);
            if (gap === 1) {
                current += 1;
            } else {
                break;
            }
        }

        habit.currentStreak = current;
        habit.bestStreak = best;
    }

    private getYearlyCounts(habitId: string, year: number): number[] {
        const habit = this.habits.find((item) => item.id === habitId);
        if (!habit) {
            return new Array<number>(12).fill(0);
        }

        const result = new Array<number>(12).fill(0);
        for (const dateKey of habit.history) {
            const y = Number(dateKey.slice(0, 4));
            if (y !== year) {
                continue;
            }

            const monthIndex = Number(dateKey.slice(5, 7)) - 1;
            result[monthIndex] += 1;
        }

        return result;
    }

    private toPolylinePoints(values: number[], maxY: number): string {
        if (!values.length) {
            return '';
        }

        const width = 360;
        const height = 170;
        const xPad = 18;
        const yPad = 18;
        const chartW = width - xPad * 2;
        const chartH = height - yPad * 2;
        const denominator = Math.max(maxY, 1);

        return values
            .map((value, index) => {
                const x = values.length === 1 ? width / 2 : xPad + (index / (values.length - 1)) * chartW;
                const y = yPad + chartH - (Math.max(0, value) / denominator) * chartH;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
    }

    private sortHabits(): void {
        this.habits = [...this.habits].sort((a, b) => a.name.localeCompare(b.name));
    }

    private resetDraft(): void {
        this.draftName = '';
        this.draftCategory = this.categoryOptions[0];
        this.draftReminderTime = '00:00';
        this.formError = '';
    }

    private nextMonthKey(monthKey: string): string {
        const [yearStr, monthStr] = monthKey.split('-');
        const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
        date.setMonth(date.getMonth() + 1);
        return this.toMonthKey(date);
    }

    private toShortLabel(name: string): string {
        const clean = name.trim();
        if (clean.length <= 6) {
            return clean;
        }

        return `${clean.slice(0, 5)}.`;
    }

    private isDuplicateHabitName(name: string): boolean {
        const normalized = name.trim().toLowerCase();
        return this.habits.some((habit) => {
            if (this.editingHabitId && habit.id === this.editingHabitId) {
                return false;
            }

            return habit.name.trim().toLowerCase() === normalized;
        });
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

    private toMonthKey(date: Date): string {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        return `${year}-${month}`;
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
            this.notificationInfo = 'Mode web aktif: notifikasi sistem belum tersedia, pakai reminder in-app.';
            return;
        }

        try {
            const permissions = await LocalNotifications.checkPermissions();
            let displayPermission = permissions.display;
            if (displayPermission !== 'granted') {
                const requested = await LocalNotifications.requestPermissions();
                displayPermission = requested.display;
            }

            this.notificationPermissionGranted = displayPermission === 'granted';
            this.notificationInfo = this.notificationPermissionGranted
                ? 'Notifikasi perangkat aktif. Reminder harian berjalan otomatis.'
                : 'Izin notifikasi belum aktif. Aktifkan izin notifikasi agar reminder muncul di perangkat.';

            await this.syncLocalNotifications();
        } catch {
            // Keep app usable if notifications fail.
            this.notificationInfo = 'Gagal mengaktifkan notifikasi perangkat, reminder in-app tetap jalan.';
        }
    }

    private async syncLocalNotifications(): Promise<void> {
        if (!this.isNativePlatform()) {
            return;
        }

        if (!this.notificationPermissionGranted) {
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
                    const [hour, minute] = (habit.reminderTime ?? '00:00').split(':').map(Number);
                    return {
                        id: this.notificationIdFromHabit(habit.id),
                        title: 'Hibitty Reminder',
                        body: `${habit.name} - waktunya check-in hari ini.`,
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
            // Ignore scheduling issues for unsupported environments.
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
