"use client";

import * as React from "react";

export type Language = "vi" | "en";

const STORAGE_KEY = "selfplanner.language.v1";

const languageLabels: Record<Language, string> = {
  vi: "VI",
  en: "EN",
};

type TranslationKey =
  | "dashboard"
  | "calendar"
  | "timeline"
  | "payments"
  | "settings"
  | "signOut"
  | "collapse"
  | "workspace"
  | "signedInAs"
  | "backendOnline"
  | "backendOffline"
  | "backendChecking"
  | "backendOnlineFun"
  | "backendUsingSupabase"
  | "backendServer"
  | "mainServer1"
  | "refresh"
  | "lastCheck"
  | "add"
  | "edit"
  | "update"
  | "create"
  | "delete"
  | "cancel"
  | "close"
  | "save"
  | "loading"
  | "empty"
  | "apply"
  | "active"
  | "inactive"
  | "paused"
  | "optional"
  | "all"
  | "categories"
  | "currentFilters"
  | "nextDue"
  | "noDescription"
  | "dayOfMonth"
  | "amount"
  | "name"
  | "date"
  | "category"
  | "saving"
  | "currency"
  | "description"
  | "paymentMethod"
  | "payment"
  | "paymentsLabel"
  | "noRecurringPayments"
  | "createFirstPayment"
  | "event"
  | "events"
  | "title"
  | "startDate"
  | "endDate"
  | "color"
  | "recurringEvent"
  | "rrule"
  | "storeRrule"
  | "clickDateToAddEvent"
  | "dragEventToMoveDate"
  | "markPending"
  | "markDone"
  | "reopen"
  | "noEventsMatch"
  | "createFirstEvent"
  | "addPayment"
  | "editPayment"
  | "addEvent"
  | "editEvent"
  | "createEvent"
  | "updateEvent"
  | "addCalendarEvent"
  | "managePersonalEvents"
  | "manageAccount"
  | "saveChanges"
  | "controlPreferences"
  | "paymentReminders"
  | "enablePushReminders"
  | "notifyMeBefore"
  | "chooseLeadTime"
  | "nativeReminderSync"
  | "allowNotifications"
  | "syncReminders"
  | "starDensity"
  | "strongDensityDesc"
  | "light"
  | "strong"
  | "parallaxIntensity"
  | "parallaxDesc"
  | "appliedInstantly"
  | "androidWidget"
  | "widgetSnapshotMissing"
  | "generateSnapshot"
  | "requestWidgetRefresh"
  | "schemaHealth"
  | "notCheckedYet"
  | "healthy"
  | "mismatch"
  | "unknown"
  | "recheckSchema"
  | "runSchema"
  | "appVersion"
  | "framework"
  | "platform"
  | "theme"
  | "about"
  | "notifications"
  | "permission"
  | "spaceVisualFx"
  | "snapshotAt"
  | "privacySecurity"
  | "privacySecurityDesc"
  | "androidReady"
  | "androidReadyDesc"
  | "singleUserWorkspace"
  | "singleUserWorkspaceDesc"
  | "singleUserPrivateWorkspace"
  | "recurringPayments"
  | "upcoming30Days"
  | "totalThisMonth"
  | "nextPayment"
  | "activeRecurring"
  | "subscriptionsCurrentlyActive"
  | "quickActions"
  | "currentExchangeRates"
  | "realtime60s"
  | "refreshing"
  | "selectedPair"
  | "noPreviousSnapshot"
  | "trend"
  | "range"
  | "latestPoints"
  | "couldNotLoadExchangeRates"
  | "upcomingPayments"
  | "groupedByOriginalCurrency"
  | "noUpcomingPayment"
  | "recurringSources"
  | "calendarEventsLabel"
  | "teamReviewPlaceholder"
  | "descriptionOptional"
  | "typeReminderDays"
  | "typeStatus"
  | "typeCategory"
  | "typeToSearch"
  | "noMatchingOptions"
  | "quickTimelineEvent"
  | "quickCalendarEvent"
  | "daysLeft"
  | "notificationPermissionGranted"
  | "notificationPermissionDenied"
  | "syncLocalReminders"
  | "couldNotSyncReminders"
  | "widgetSnapshotGenerated"
  | "widgetRefreshRequested"
  | "checkingSchema"
  | "couldNotVerifySchema"
  | "missingColumns"
  | "schemaLooksGood"
  | "schemaMismatchDetected"
  | "notCheckedYet2"
  | "paymentEventsManagedInPayments"
  | "eventsTotal"
  | "completed"
  | "swipeToFilter"
  | "statusFilter"
  | "resetFilters"
  | "statusAll"
  | "statusPending"
  | "statusDone"
  | "statusCancelled"
  | "categoryFinance"
  | "categoryWork"
  | "categoryPersonal"
  | "categoryHealth"
  | "categoryLearning"
  | "categoryOther"
  | "appLanguage"
  | "loginTitle"
  | "loginSubtitle"
  | "loginHeroTitle"
  | "loginHeroBody"
  | "loginRealtime"
  | "loginRealtimeBody"
  | "loginPrivate"
  | "loginPrivateBody"
  | "email"
  | "password"
  | "login"
  | "personalProject"
  | "language";

const translations: Record<Language, Record<TranslationKey, string>> = {
  vi: {
    dashboard: "Bảng điều khiển",
    calendar: "Lịch",
    timeline: "Dòng thời gian",
    payments: "Thanh toán",
    settings: "Cài đặt",
    signOut: "Đăng xuất",
    collapse: "Thu gọn",
    workspace: "Khu làm việc",
    signedInAs: "Đã đăng nhập với",
    backendOnline: "Backend online",
    backendOffline: "Backend offline",
    backendChecking: "Đang kiểm tra...",
    backendOnlineFun: "Server chạy mượt, sẵn sàng chiến mọi tác vụ.",
    backendUsingSupabase: "Đang dùng trực tiếp Supabase",
    backendServer: "Máy chủ backend",
    mainServer1: "Main Server 1",
    refresh: "Làm mới",
    lastCheck: "Kiểm tra gần nhất",
    add: "Thêm",
    edit: "Sửa",
    update: "Cập nhật",
    create: "Tạo",
    delete: "Xoá",
    cancel: "Huỷ",
    close: "Đóng",
    save: "Lưu",
    loading: "Đang tải...",
    empty: "Trống",
    apply: "Áp dụng",
    active: "Đang hoạt động",
    inactive: "Không hoạt động",
    paused: "Tạm dừng",
    optional: "tuỳ chọn",
    all: "Tất cả",
    categories: "Danh mục",
    currentFilters: "Bộ lọc hiện tại",
    nextDue: "Hạn tiếp theo",
    noDescription: "Không có mô tả",
    dayOfMonth: "Ngày trong tháng",
    amount: "Số tiền",
    name: "Tên",
    date: "Ngày",
    category: "Danh mục",
    saving: "Đang lưu...",
    currency: "Tiền tệ",
    description: "Mô tả",
    paymentMethod: "Phương thức",
    payment: "Khoản thanh toán",
    paymentsLabel: "payments",
    noRecurringPayments: "Chưa có recurring payment nào",
    createFirstPayment: "Tạo payment đầu tiên",
    event: "Sự kiện",
    events: "Sự kiện",
    title: "Tiêu đề",
    startDate: "Ngày bắt đầu",
    endDate: "Ngày kết thúc",
    color: "Màu sắc",
    recurringEvent: "Sự kiện lặp lại",
    rrule: "RRULE",
    storeRrule: "Lưu chuỗi RRULE khi bật",
    clickDateToAddEvent: "Bấm ngày để thêm sự kiện",
    dragEventToMoveDate: "Kéo sự kiện để đổi ngày",
    markPending: "Đánh dấu chờ",
    markDone: "Đánh dấu xong",
    reopen: "Mở lại",
    noEventsMatch: "Không có sự kiện nào khớp với bộ lọc hiện tại.",
    createFirstEvent: "Tạo sự kiện đầu tiên",
    addPayment: "Thêm Payment",
    editPayment: "Sửa Payment",
    addEvent: "Thêm sự kiện",
    editEvent: "Sửa sự kiện",
    createEvent: "Tạo sự kiện",
    updateEvent: "Cập nhật sự kiện",
    addCalendarEvent: "Thêm Calendar Event",
    managePersonalEvents: "Quản lý sự kiện cá nhân và ngày đến hạn thanh toán trong một nơi.",
    manageAccount: "Quản lý tài khoản và tuỳ chọn thông báo.",
    saveChanges: "Lưu thay đổi",
    controlPreferences: "Điều khiển tài khoản và thông báo của anh.",
    paymentReminders: "Nhắc thanh toán",
    enablePushReminders: "Bật nhắc đẩy trước ngày đến hạn",
    notifyMeBefore: "Nhắc trước",
    chooseLeadTime: "Chọn số ngày nhắc trước",
    nativeReminderSync: "Đồng bộ nhắc nhở native",
    allowNotifications: "Cho phép thông báo",
    syncReminders: "Đồng bộ nhắc nhở",
    starDensity: "Mật độ sao",
    strongDensityDesc: "Mạnh = nhiều sao hơn + nhiều comet hơn",
    light: "Nhẹ",
    strong: "Mạnh",
    parallaxIntensity: "Cường độ parallax",
    parallaxDesc: "Di chuyển sao theo con trỏ và độ nghiêng thiết bị",
    appliedInstantly: "Áp dụng ngay và lưu trên thiết bị này.",
    androidWidget: "Android Widget (Sẵn sàng)",
    widgetSnapshotMissing: "Chưa có snapshot widget. Mở Dashboard để app tạo snapshot đầu tiên.",
    generateSnapshot: "Tạo Snapshot",
    requestWidgetRefresh: "Yêu cầu làm mới Widget",
    schemaHealth: "Tình trạng Schema",
    notCheckedYet: "Chưa kiểm tra.",
    healthy: "Tốt",
    mismatch: "Lệch",
    unknown: "Không rõ",
    recheckSchema: "Kiểm tra lại Schema",
    runSchema: "Chạy supabase-schema.sql trong Supabase SQL Editor rồi kiểm tra lại.",
    appVersion: "Phiên bản app",
    framework: "Framework",
    platform: "Nền tảng",
    theme: "Giao diện",
    about: "Giới thiệu",
    notifications: "Thông báo",
    permission: "Quyền",
    spaceVisualFx: "Hiệu ứng không gian",
    snapshotAt: "Snapshot lúc",
    privacySecurity: "Riêng tư & bảo mật",
    privacySecurityDesc: "Dữ liệu được bảo vệ bởi Supabase RLS.",
    androidReady: "Sẵn sàng cho Android",
    androidReadyDesc: "Hỗ trợ FCM token cho thông báo đẩy.",
    singleUserWorkspace: "Không gian làm việc một người dùng",
    singleUserWorkspaceDesc: "Tối ưu cho luồng quản lý cá nhân.",
    singleUserPrivateWorkspace: "Không gian riêng tư cho một người dùng",
    recurringPayments: "Thanh toán định kỳ",
    upcoming30Days: "30 ngày tới",
    totalThisMonth: "Tổng tháng này",
    nextPayment: "Khoản thanh toán tiếp theo",
    activeRecurring: "Đang lặp",
    subscriptionsCurrentlyActive: "Các khoản đang hoạt động",
    quickActions: "Thao tác nhanh",
    currentExchangeRates: "Tỷ giá hiện tại (so với VND)",
    realtime60s: "Realtime (60 giây)",
    refreshing: "Đang làm mới...",
    selectedPair: "Cặp đang chọn",
    noPreviousSnapshot: "Chưa có snapshot trước đó",
    trend: "Xu hướng",
    range: "Biên độ",
    latestPoints: "điểm mới nhất",
    couldNotLoadExchangeRates: "Không thể tải tỷ giá lúc này.",
    upcomingPayments: "payments",
    groupedByOriginalCurrency: "Nhóm theo tiền tệ gốc",
    noUpcomingPayment: "Không có payment sắp tới",
    recurringSources: "nguồn lặp",
    calendarEventsLabel: "sự kiện lịch",
    teamReviewPlaceholder: "Họp nhóm, khám bệnh...",
    descriptionOptional: "Ghi chú tuỳ chọn",
    typeReminderDays: "Nhập số ngày nhắc...",
    typeStatus: "Nhập trạng thái...",
    typeCategory: "Nhập danh mục...",
    typeToSearch: "Nhập để tìm...",
    noMatchingOptions: "Không có tuỳ chọn phù hợp",
    quickTimelineEvent: "Sự kiện nhanh",
    quickCalendarEvent: "Sự kiện lịch nhanh",
    daysLeft: "ngày nữa",
    notificationPermissionGranted: "Đã cấp quyền thông báo",
    notificationPermissionDenied: "Đã từ chối quyền thông báo",
    syncLocalReminders: "Đồng bộ nhắc nhở cục bộ từ các recurring payment đang active.",
    couldNotSyncReminders: "Không thể đồng bộ nhắc nhở.",
    widgetSnapshotGenerated: "Đã tạo widget snapshot",
    widgetRefreshRequested: "Đã gửi yêu cầu làm mới widget",
    checkingSchema: "Đang kiểm tra schema...",
    couldNotVerifySchema: "Không thể xác minh tình trạng schema.",
    missingColumns: "Thiếu cột",
    schemaLooksGood: "Schema ổn cho recurring payments.",
    schemaMismatchDetected: "Phát hiện lệch schema. Cần migration.",
    notCheckedYet2: "Chưa kiểm tra.",
    paymentEventsManagedInPayments: "Các payment định kỳ được quản lý trong Payments.",
    eventsTotal: "tổng sự kiện",
    completed: "hoàn thành",
    swipeToFilter: "Vuốt trái/phải để đổi bộ lọc trạng thái nhanh.",
    statusFilter: "Bộ lọc trạng thái",
    resetFilters: "Đặt lại bộ lọc",
    statusAll: "Tất cả",
    statusPending: "Chờ xử lý",
    statusDone: "Hoàn thành",
    statusCancelled: "Đã huỷ",
    categoryFinance: "Tài chính",
    categoryWork: "Công việc",
    categoryPersonal: "Cá nhân",
    categoryHealth: "Sức khoẻ",
    categoryLearning: "Học tập",
    categoryOther: "Khác",
    appLanguage: "Ngôn ngữ",
    loginTitle: "Đăng nhập",
    loginSubtitle: "Chào mừng quay lại, tiếp tục luồng quản lý cá nhân của anh.",
    loginHeroTitle: "SelfPlanner",
    loginHeroBody:
      "Lên kế hoạch thanh toán, sự kiện và các mốc cá nhân trong một không gian yên tĩnh với thông tin realtime.",
    loginRealtime: "Realtime Insights",
    loginRealtimeBody: "Tỷ giá và triển vọng tháng nhìn nhanh gọn.",
    loginPrivate: "Riêng tư theo thiết kế",
    loginPrivateBody: "Supabase RLS giữ từng dòng dữ liệu trong phạm vi tài khoản của anh.",
    email: "Email",
    password: "Mật khẩu",
    login: "Đăng nhập",
    personalProject: "Dự án cá nhân - giao diện dark starfield",
    language: "Ngôn ngữ",
  },
  en: {
    dashboard: "Dashboard",
    calendar: "Calendar",
    timeline: "Timeline",
    payments: "Payments",
    settings: "Settings",
    signOut: "Sign Out",
    collapse: "Collapse",
    workspace: "Workspace",
    signedInAs: "Signed in as",
    backendOnline: "Backend online",
    backendOffline: "Backend offline",
    backendChecking: "Checking...",
    backendOnlineFun: "Server is cruising smoothly and ready for action.",
    backendUsingSupabase: "Using Supabase directly",
    backendServer: "Backend server",
    mainServer1: "Main Server 1",
    refresh: "Refresh",
    lastCheck: "Last check",
    add: "Add",
    edit: "Edit",
    update: "Update",
    create: "Create",
    delete: "Delete",
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    loading: "Loading...",
    empty: "Empty",
    apply: "Apply",
    active: "Active",
    inactive: "Inactive",
    paused: "Paused",
    optional: "optional",
    all: "All",
    categories: "Categories",
    currentFilters: "Current filters",
    nextDue: "Next due",
    noDescription: "No description",
    dayOfMonth: "Day of month",
    amount: "Amount",
    name: "Name",
    date: "Date",
    category: "Category",
    saving: "Saving...",
    currency: "Currency",
    description: "Description",
    paymentMethod: "Payment method",
    payment: "Payment",
    paymentsLabel: "payments",
    noRecurringPayments: "No recurring payments yet",
    createFirstPayment: "Create first payment",
    event: "Event",
    events: "Events",
    title: "Title",
    startDate: "Start date",
    endDate: "End date",
    color: "Color",
    recurringEvent: "Recurring event",
    rrule: "RRULE",
    storeRrule: "Store RRULE string when enabled",
    clickDateToAddEvent: "Click date to add event",
    dragEventToMoveDate: "Drag event to move date",
    markPending: "Mark pending",
    markDone: "Mark done",
    reopen: "Re-open",
    noEventsMatch: "No events match your current filters.",
    createFirstEvent: "Create first event",
    addPayment: "Add Payment",
    editPayment: "Edit Payment",
    addEvent: "Add Event",
    editEvent: "Edit Event",
    createEvent: "Create Event",
    updateEvent: "Update Event",
    addCalendarEvent: "Add Calendar Event",
    managePersonalEvents: "Manage personal events and recurring payment due dates in one place.",
    manageAccount: "Control your account and notification preferences.",
    saveChanges: "Save Changes",
    controlPreferences: "Control your account and notification preferences.",
    paymentReminders: "Payment reminders",
    enablePushReminders: "Enable push reminders before due dates",
    notifyMeBefore: "Notify me before",
    chooseLeadTime: "Choose lead time for reminder notifications",
    nativeReminderSync: "Native reminder sync",
    allowNotifications: "Allow Notifications",
    syncReminders: "Sync Reminders",
    starDensity: "Star density",
    strongDensityDesc: "Strong = denser stars + more comet bursts",
    light: "Light",
    strong: "Strong",
    parallaxIntensity: "Parallax intensity",
    parallaxDesc: "Move stars with pointer and device tilt",
    appliedInstantly: "Applied instantly and saved on this device.",
    androidWidget: "Android Widget (Ready)",
    widgetSnapshotMissing: "Widget snapshot is missing. Open Dashboard to generate the first snapshot.",
    generateSnapshot: "Generate Snapshot",
    requestWidgetRefresh: "Request Widget Refresh",
    schemaHealth: "Schema Health",
    notCheckedYet: "Not checked yet.",
    healthy: "Healthy",
    mismatch: "Mismatch",
    unknown: "Unknown",
    recheckSchema: "Re-check Schema",
    runSchema: "Run supabase-schema.sql in Supabase SQL Editor, then re-check.",
    appVersion: "App Version",
    framework: "Framework",
    platform: "Platform",
    theme: "Theme",
    about: "About",
    notifications: "Notifications",
    permission: "Permission",
    spaceVisualFx: "Space Visual FX",
    snapshotAt: "Snapshot at",
    privacySecurity: "Privacy & Security",
    privacySecurityDesc: "Data protected by Supabase RLS.",
    androidReady: "Android Ready",
    androidReadyDesc: "FCM token supported for push notifications.",
    singleUserWorkspace: "Single User Workspace",
    singleUserWorkspaceDesc: "Optimized for personal planning flow.",
    singleUserPrivateWorkspace: "Single-user private workspace",
    recurringPayments: "Recurring Payments",
    upcoming30Days: "Upcoming 30 days",
    totalThisMonth: "Total this month",
    nextPayment: "Next payment",
    activeRecurring: "Active recurring",
    subscriptionsCurrentlyActive: "Subscriptions currently active",
    quickActions: "Quick actions",
    currentExchangeRates: "Current Exchange Rates (to VND)",
    realtime60s: "Realtime (60s)",
    refreshing: "Refreshing...",
    selectedPair: "Selected Pair",
    noPreviousSnapshot: "No previous snapshot",
    trend: "Trend",
    range: "Range",
    latestPoints: "latest points",
    couldNotLoadExchangeRates: "Could not load exchange rates right now.",
    upcomingPayments: "payments",
    groupedByOriginalCurrency: "Grouped by original currency",
    noUpcomingPayment: "No upcoming payment",
    recurringSources: "recurring sources",
    calendarEventsLabel: "calendar events",
    teamReviewPlaceholder: "Team review, doctor visit...",
    descriptionOptional: "Optional note",
    typeReminderDays: "Type reminder days...",
    typeStatus: "Type status...",
    typeCategory: "Type category...",
    typeToSearch: "Type to search...",
    noMatchingOptions: "No matching options",
    quickTimelineEvent: "Quick Timeline Event",
    quickCalendarEvent: "Quick Calendar Event",
    daysLeft: "days left",
    notificationPermissionGranted: "Notification permission granted",
    notificationPermissionDenied: "Notification permission denied",
    syncLocalReminders: "Sync local reminders from active recurring payments.",
    couldNotSyncReminders: "Could not sync reminders.",
    widgetSnapshotGenerated: "Widget snapshot generated",
    widgetRefreshRequested: "Widget refresh request sent",
    checkingSchema: "Checking schema...",
    couldNotVerifySchema: "Could not verify schema health.",
    missingColumns: "Missing columns",
    schemaLooksGood: "Schema looks good for recurring payments.",
    schemaMismatchDetected: "Schema mismatch detected. Migration is required.",
    notCheckedYet2: "Not checked yet.",
    paymentEventsManagedInPayments: "Recurring payment events are managed in Payments.",
    eventsTotal: "events total",
    completed: "completed",
    swipeToFilter: "Swipe left/right on the timeline to change status filters quickly.",
    statusFilter: "Status filter",
    resetFilters: "Reset filters",
    statusAll: "All",
    statusPending: "Pending",
    statusDone: "Done",
    statusCancelled: "Cancelled",
    categoryFinance: "Finance",
    categoryWork: "Work",
    categoryPersonal: "Personal",
    categoryHealth: "Health",
    categoryLearning: "Learning",
    categoryOther: "Other",
    appLanguage: "Language",
    loginTitle: "Sign in",
    loginSubtitle: "Welcome back, continue your personal planning flow.",
    loginHeroTitle: "SelfPlanner",
    loginHeroBody:
      "Plan payments, events, and personal milestones in one calm workspace with realtime insights.",
    loginRealtime: "Realtime Insights",
    loginRealtimeBody: "Exchange rates and monthly outlook at a glance.",
    loginPrivate: "Private by Design",
    loginPrivateBody: "Supabase RLS keeps every row scoped to your account.",
    email: "Email",
    password: "Password",
    login: "Sign In",
    personalProject: "Personal project - dark starfield UI",
    language: "Language",
  },
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  labels: typeof translations.vi;
};

const LanguageContext = React.createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("vi");

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "vi" || stored === "en") {
      setLanguageState(stored);
      return;
    }

    const browserLanguage = window.navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
    setLanguageState(browserLanguage);
  }, []);

  const setLanguage = React.useCallback((next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const toggleLanguage = React.useCallback(() => {
    setLanguageState((current) => {
      const next = current === "vi" ? "en" : "vi";
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
      return next;
    });
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = React.useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      labels: translations[language],
    }),
    [language, setLanguage, toggleLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export function getLanguageLabel(language: Language): string {
  return languageLabels[language];
}

export function getTranslation(language: Language, key: TranslationKey): string {
  return translations[language][key];
}
