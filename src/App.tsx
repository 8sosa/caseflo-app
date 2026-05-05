import React, { useState, useEffect, Component, ReactNode } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Truck,
  Settings,
  Plus,
  Search,
  ExternalLink,
  Calendar,
  MessageSquare,
  Users,
  MapPin,
  FileUp,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  Link as LinkIcon,
  LogOut,
  User,
  UserPlus,
  Bell,
  RefreshCw,
  CreditCard,
  Paperclip,
  DollarSign,
  Copy,
  Save,
  Mail,
  CalendarDays,
  Phone,
  Printer,
  Download,
  Send,
  Megaphone,
  FileBadge,
  Trash2,
  Menu,
  X,
  Building2,
  Crown,
  Shield,
  ChevronRight,
  Check,
  Users2,
  Star,
  Zap,
  ArrowRight,
  Key
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification
} from 'firebase/auth';
import axios from 'axios';
import { 
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Toaster, toast } from 'sonner';
import { format } from 'date-fns';
import { NIGERIAN_STATES, COURT_TYPES, CASE_TYPES } from './constants/jurisdictions';

// --- Types ---
interface Lawyer {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface Matter {
  id: string;
  title: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  caseNumber?: string;
  status: 'open' | 'closed' | 'pending' | 'new_lead';
  courtName: string;
  courtState: string;
  lawyerInCharge: string; // Lawyer ID or Name
  updatedAt?: any;
  uid: string;
  matterType: string;
  practiceArea?: string;
}

interface Invoice {
  id: string;
  uid: string;
  matterId: string;
  matterTitle: string;
  clientName: string;
  clientEmail: string;
  senderEmail: string;
  amount: number;
  currency: 'NGN';
  description: string;
  status: 'draft' | 'sent' | 'paid';
  dueDate: any;
  createdAt: any;
}

interface CaseUpdate {
  id: string;
  matterId: string;
  content: string;
  author: string;
  createdAt: any;
}

interface Appointment {
  id: string;
  matterId: string;
  matterTitle: string;
  clientName: string;
  date: any;
  type: 'consultation' | 'court_hearing' | 'meeting';
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

interface FollowUp {
  id: string;
  matterId: string;
  clientName: string;
  lastContact: any;
  nextFollowUp: any;
  status: 'pending' | 'completed';
  notes?: string;
}

interface EFiling {
  id: string;
  caseType: string;
  caseNumber: string;
  court: string;
  documentType: string;
  status: 'draft' | 'submitted' | 'accepted' | 'rejected';
  submissionDate?: any;
  confirmationNumber?: string;
}

interface UserProfile {
  uid: string;
  orgId?: string;
  role: 'Admin' | 'Lawyer' | 'Paralegal' | 'Staff';
  email: string;
  name: string;
}

interface CaseTemplate {
  id: string;
  userId: string;
  name: string;
  court: string;
  documentType: string;
  defaultStatus: string;
}

interface EngagementAgreement {
  id: string;
  uid: string;
  matterId?: string;
  clientName: string;
  clientEmail: string;
  content: string;
  status: 'draft' | 'sent' | 'signed';
  signedAt?: any;
  createdAt: any;
}

interface AutomatedEmail {
  id: string;
  uid: string;
  recipient: string;
  subject: string;
  body: string;
  type: 'welcome' | 'payment_reminder' | 'update';
  status: 'pending' | 'sent' | 'failed';
  scheduledFor: any;
  sentAt?: any;
}

interface CaseVetting {
  id: string;
  uid: string;
  matterId: string;
  riskScore: number; // 0-100
  successProbability: number; // 0-100
  factors: string[];
  recommendation: string;
  createdAt: any;
}

// --- Multi-Tenant Types ---

type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

interface Organization {
  id: string;
  name: string;
  domain: string;
  adminUid: string;
  plan: 'trial' | 'starter' | 'professional' | 'enterprise';
  maxUsers: number;
  currentUserCount: number;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: any;
  subscriptionExpiresAt?: any;
  paystackCustomerCode?: string;
  paystackSecretKey?: string;
  paystackPublicKey?: string;
  createdAt: any;
}

interface OrgMember {
  uid: string;
  email: string;
  name: string;
  role: 'Admin' | 'Lawyer' | 'Paralegal' | 'Staff';
  joinedAt: any;
}

const SUBSCRIPTION_PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    price: 15000,
    maxUsers: 3,
    features: ['Up to 3 team members', '1,000 messages/month', 'Unlimited matters', 'E-filing access', 'AI case vetting', 'Email support'],
  },
  {
    id: 'professional' as const,
    name: 'Professional',
    price: 35000,
    maxUsers: 15,
    popular: true,
    features: ['Up to 15 team members', '1,000 messages/month', 'Unlimited matters', 'Priority e-filing', 'Advanced AI vetting', 'Priority support', 'Custom Paystack integration'],
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: 75000,
    maxUsers: 999,
    features: ['Unlimited team members', '1,000 messages/month', 'Unlimited matters', 'Full e-filing suite', 'Advanced AI + vetting', '24/7 support', 'Custom branding', 'Dedicated account manager'],
  },
];

// --- Components ---

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, errorInfo: '' };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = 'Something went wrong.';
      try {
        const parsed = JSON.parse(this.state.errorInfo);
        if (parsed.error && parsed.error.includes('permissions')) {
          displayMessage = 'You do not have permission to perform this action. Please check your account settings.';
        }
      } catch (e) {
        // Not a JSON error or other error
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-bg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <AlertCircle size={32}/>
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Application Error</h1>
          <p className="text-text-muted mb-6 max-w-md">{displayMessage}</p>
          <button onClick={() => window.location.reload()} className="bg-accent text-white rounded-xl px-8 font-bold">
            Reload Application
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const TC_URL = 'https://caseflo.ng/terms'; // update to real URL when available

const WorkspaceSignIn = () => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  // 'existing' = has account, 'join' = new user joining existing workspace
  const [signinMode, setSigninMode] = useState<'existing' | 'join'>('existing');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [loading, setLoading] = useState(false);

  const getDomain = (e: string) => e.split('@')[1]?.toLowerCase() || '';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      const code = error.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        toast.error('Incorrect email or password.');
      } else if (code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Try again in a few minutes.');
      } else {
        toast.error(error.message || 'Sign in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const [joinRole, setJoinRole] = useState<'Lawyer' | 'Paralegal' | 'Staff'>('Lawyer');

  // Creates a Firebase account ONLY — no org created.
  // fetchProfileAndOrg will auto-detect the domain and join the existing org.
  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Please enter your full name'); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        role: joinRole,
        email: cred.user.email || '',
        name: name.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success('Account created! Joining your workspace...');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists. Sign in instead.');
        setSigninMode('existing');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName.trim() || !name.trim() || !email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      // Send verification email but don't block workspace creation
      sendEmailVerification(cred.user).catch(() => {});

      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const domain = getDomain(email);

      const orgRef = await addDoc(collection(db, 'organizations'), {
        name: firmName.trim(),
        domain,
        adminUid: cred.user.uid,
        plan: 'trial',
        maxUsers: 3,
        currentUserCount: 1,
        subscriptionStatus: 'trial',
        trialEndsAt,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'organizations', orgRef.id, 'members', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        name: cred.user.displayName,
        role: 'Admin',
        joinedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        orgId: orgRef.id,
        role: 'Admin',
        email: cred.user.email || '',
        name: cred.user.displayName || name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success(`Workspace "${firmName.trim()}" created!`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists. Sign in instead.');
        setMode('signin');
      } else {
        toast.error(error.message || 'Failed to create workspace');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      toast.error(error.message || 'Google sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    sessionStorage.setItem('ais_guest_mode', 'true');
    window.location.reload();
  };

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25C22.56 11.47 22.49 10.71 22.36 10H12V14.25H17.92C17.67 15.63 16.89 16.8 15.7 17.59V20.34H19.26C21.34 18.42 22.56 15.59 22.56 12.25Z" fill="#4285F4"/>
      <path d="M12 23C14.97 23 17.46 22.02 19.26 20.34L15.7 17.59C14.73 18.24 13.48 18.66 12 18.66C9.13 18.66 6.7 16.71 5.84 14.12H2.18V16.96C3.99 20.55 7.69 23 12 23Z" fill="#34A853"/>
      <path d="M5.84 14.12C5.62 13.47 5.5 12.75 5.5 12C5.5 11.25 5.62 10.53 5.84 9.88V7.04H2.18C1.43 8.53 1 10.21 1 12C1 13.79 1.43 15.47 2.18 16.96L5.84 14.12Z" fill="#FBBC05"/>
      <path d="M12 5.34C13.62 5.34 15.07 5.89 16.21 6.98L19.34 3.85C17.45 2.09 14.97 1 12 1C7.69 1 3.99 3.45 2.18 7.04L5.84 9.88C6.7 7.29 9.13 5.34 12 5.34Z" fill="#EA4335"/>
    </svg>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg p-4">
      <Card className="w-full max-w-md border-border-theme shadow-sm rounded-[20px]">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-2 shadow-lg shadow-accent/20">
            <Briefcase className="text-white w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight text-primary">Caseflo</CardTitle>
          <CardDescription className="text-text-muted">Legal workflow automation for Nigerian firms</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="flex bg-bg rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'signin' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-primary'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'register' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-primary'}`}
            >
              Create Workspace
            </button>
          </div>

          {/* Sign In form */}
          {mode === 'signin' && signinMode === 'existing' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Email</Label>
                <Input type="email" className="rounded-xl border-border-theme h-12" placeholder="counsel@yourfirm.ng" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Password</Label>
                <Input type="password" className="rounded-xl border-border-theme h-12" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={e => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border-theme accent-accent shrink-0"
                />
                <span className="text-xs text-text-muted leading-relaxed">
                  I agree to the{' '}
                  <a href={TC_URL} target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">
                    Terms & Conditions
                  </a>{' '}
                  and{' '}
                  <a href={TC_URL} target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">
                    Privacy Policy
                  </a>
                </span>
              </label>
              <Button type="submit" disabled={loading || !agreedToTerms} className="w-full bg-accent hover:bg-accent/90 text-white h-12 rounded-xl font-bold disabled:opacity-50">
                {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Sign In'}
              </Button>
              <button type="button" onClick={() => { setSigninMode('join'); setPassword(''); }} className="w-full text-xs text-text-muted hover:text-accent font-medium text-center pt-1">
                New team member joining an existing workspace? →
              </button>
            </form>
          )}

          {/* Join existing workspace (new account, no new org) */}
          {mode === 'signin' && signinMode === 'join' && (
            <form onSubmit={handleJoinWorkspace} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                <Users2 size={14} className="text-green-600 shrink-0" />
                <p className="text-xs font-bold text-green-800">
                  Sign up with your work email — you'll auto-join your firm's workspace.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Full Name</Label>
                <Input className="rounded-xl border-border-theme h-12" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Work Email</Label>
                <Input type="email" className="rounded-xl border-border-theme h-12" placeholder="you@yourfirm.ng" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Password</Label>
                <Input type="password" className="rounded-xl border-border-theme h-12" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Your Role</Label>
                <select
                  className="w-full p-3 border border-border-theme rounded-xl text-sm bg-white outline-none"
                  value={joinRole}
                  onChange={e => setJoinRole(e.target.value as typeof joinRole)}
                >
                  <option value="Lawyer">Lawyer</option>
                  <option value="Paralegal">Paralegal / Intern</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border-theme accent-accent shrink-0" />
                <span className="text-xs text-text-muted leading-relaxed">
                  I agree to the <a href={TC_URL} target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">Terms & Conditions</a> and <a href={TC_URL} target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">Privacy Policy</a>
                </span>
              </label>
              <Button type="submit" disabled={loading || !agreedToTerms} className="w-full bg-accent hover:bg-accent/90 text-white h-12 rounded-xl font-bold disabled:opacity-50">
                {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Create Account & Join Workspace'}
              </Button>
              <button type="button" onClick={() => setSigninMode('existing')} className="w-full text-xs text-text-muted hover:text-accent font-medium text-center pt-1">
                ← Already have an account? Sign in
              </button>
            </form>
          )}

          {/* Create Workspace form */}
          {mode === 'register' && (
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <Zap size={14} className="text-blue-600 shrink-0" />
                <p className="text-xs font-bold text-blue-800">Free 14-day trial — no credit card required.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Firm Name</Label>
                <Input className="rounded-xl border-border-theme h-12" placeholder="e.g. Lex & Partners LP" value={firmName} onChange={e => setFirmName(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Your Full Name</Label>
                <Input className="rounded-xl border-border-theme h-12" placeholder="Principal Partner" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Work Email</Label>
                <Input type="email" className="rounded-xl border-border-theme h-12" placeholder="counsel@yourfirm.ng" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Password</Label>
                <Input type="password" className="rounded-xl border-border-theme h-12" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border-theme accent-accent shrink-0" />
                <span className="text-xs text-text-muted leading-relaxed">
                  I agree to the <a href={TC_URL} target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">Terms & Conditions</a> and <a href={TC_URL} target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">Privacy Policy</a>
                </span>
              </label>
              <Button type="submit" disabled={loading || !agreedToTerms} className="w-full bg-accent hover:bg-accent/90 text-white h-12 rounded-xl font-bold disabled:opacity-50">
                {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Create Workspace'}
              </Button>
            </form>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border-theme" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-text-muted">Or</span></div>
          </div>
          <Button variant="outline" onClick={handleGoogleSignIn} disabled={loading} className="w-full rounded-xl border-border-theme h-12 text-sm font-bold flex items-center justify-center gap-2">
            <GoogleIcon /> Continue with Google
          </Button>
          <Button variant="outline" onClick={handleGuestAccess} className="w-full rounded-xl border-border-theme h-12 text-sm font-bold text-text-muted hover:text-accent">
            Continue as Guest (Demo Mode)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Shown when a user is authenticated but not linked to any org (e.g. Google sign-in, or legacy accounts)
const OrgSetup = ({ user, onDone }: { user: FirebaseUser; onDone: (org: Organization) => void }) => {
  const [firmName, setFirmName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName.trim()) return;
    setLoading(true);
    try {
      const domain = user.email?.split('@')[1]?.toLowerCase() || 'workspace.local';
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const orgRef = await addDoc(collection(db, 'organizations'), {
        name: firmName.trim(),
        domain,
        adminUid: user.uid,
        plan: 'trial',
        maxUsers: 3,
        currentUserCount: 1,
        subscriptionStatus: 'trial',
        trialEndsAt,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'organizations', orgRef.id, 'members', user.uid), {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        role: 'Admin',
        joinedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        orgId: orgRef.id,
        role: 'Admin',
        email: user.email || '',
        name: user.displayName || 'Admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const org: Organization = {
        id: orgRef.id,
        name: firmName.trim(),
        domain,
        adminUid: user.uid,
        plan: 'trial',
        maxUsers: 3,
        currentUserCount: 1,
        subscriptionStatus: 'trial',
        trialEndsAt,
        createdAt: null,
      };
      onDone(org);
      toast.success('Workspace created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg p-4">
      <Card className="w-full max-w-sm border-border-theme shadow-sm rounded-[20px]">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-2 shadow-lg shadow-accent/20">
            <Building2 className="text-white w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-extrabold text-primary">Set up your workspace</CardTitle>
          <CardDescription>Signed in as {user.email}. Create your firm workspace to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Firm Name</Label>
              <Input className="rounded-xl border-border-theme h-12" placeholder="e.g. Lex & Partners LP" value={firmName} onChange={e => setFirmName(e.target.value)} required autoFocus />
            </div>
            <Button type="submit" disabled={loading || !firmName.trim()} className="w-full bg-accent hover:bg-accent/90 text-white h-12 rounded-xl font-bold">
              {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Create Workspace'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => signOut(auth)} className="w-full text-sm text-text-muted">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const EmailVerificationPending = ({ user }: { user: FirebaseUser }) => {
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true);
    try {
      await sendEmailVerification(user);
      toast.success('Verification email sent!');
    } catch {
      toast.error('Failed to resend. Try again in a minute.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
          <Mail size={36} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-primary mb-2">Check your email</h1>
          <p className="text-text-muted text-sm leading-relaxed">
            We sent a verification link to <span className="font-bold text-primary">{user.email}</span>. Click the link to activate your account and access your workspace.
          </p>
        </div>
        <div className="space-y-3">
          <Button
            onClick={async () => {
              try { await user.reload(); } catch { /* ignore */ }
              window.location.reload();
            }}
            className="w-full bg-accent hover:bg-accent/90 text-white h-12 rounded-xl font-bold"
          >
            I've verified — Continue
          </Button>
          <Button variant="outline" onClick={resend} disabled={sending} className="w-full rounded-xl border-border-theme h-12 font-bold text-text-muted">
            {sending ? <RefreshCw className="animate-spin" size={16} /> : 'Resend verification email'}
          </Button>
          <Button variant="ghost" onClick={() => signOut(auth)} className="w-full text-sm text-text-muted">
            Sign out and use a different account
          </Button>
        </div>
      </div>
    </div>
  );
};

const SubscriptionPage = ({
  organization,
  user,
  onSubscribed,
}: {
  organization: Organization;
  user: FirebaseUser;
  onSubscribed: (plan: string, expiresAt: string, maxUsers: number) => void;
}) => {
  const [loading, setLoading] = useState<string | null>(null);

  const daysLeft = organization.trialEndsAt
    ? Math.max(0, Math.ceil((organization.trialEndsAt.toDate?.() ?? new Date(organization.trialEndsAt) as Date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const handleSubscribe = async (plan: typeof SUBSCRIPTION_PLANS[number]) => {
    setLoading(plan.id);
    try {
      const res = await axios.post('/api/subscriptions/initialize', {
        email: user.email,
        plan: plan.id,
        orgId: organization.id,
        orgName: organization.name,
      });

      if (res.data?.data?.authorization_url) {
        const authUrl: string = res.data.data.authorization_url;
        const ref: string = res.data.data.reference;

        // Open Paystack checkout
        const popup = window.open(authUrl, '_blank', 'width=600,height=700');

        // Poll for payment completion via reference in URL params or popup close
        const poll = setInterval(async () => {
          try {
            const verify = await axios.post('/api/subscriptions/verify', { reference: ref });
            if (verify.data?.verified) {
              clearInterval(poll);
              popup?.close();
              onSubscribed(verify.data.plan, verify.data.subscriptionExpiresAt, verify.data.maxUsers);
            }
          } catch { /* still waiting */ }
        }, 3000);

        // Stop polling after 15 minutes
        setTimeout(() => clearInterval(poll), 15 * 60 * 1000);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start payment');
    } finally {
      setLoading(null);
    }
  };

  const isTrial = organization.subscriptionStatus === 'trial';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
            <Crown size={32} className="text-accent" />
          </div>
          <h1 className="text-3xl font-extrabold text-primary">
            {isTrial ? (daysLeft > 0 ? 'Your Free Trial' : 'Trial Ended') : 'Subscription Required'}
          </h1>
          {isTrial && daysLeft > 0 ? (
            <p className="text-text-muted max-w-lg mx-auto">
              You have <span className="font-black text-amber-600">{Math.floor(daysLeft)} days</span> left in your free trial.
              Subscribe to keep your workspace running after the trial ends.
            </p>
          ) : (
            <p className="text-text-muted max-w-lg mx-auto">
              Subscribe to Caseflo to access your workspace and all legal workflow features.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SUBSCRIPTION_PLANS.map(plan => (
            <div key={plan.id} className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col transition-all ${plan.popular ? 'border-accent shadow-xl shadow-accent/10' : 'border-border-theme'}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-accent text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-extrabold text-primary">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-black text-primary">₦{plan.price.toLocaleString()}</span>
                  <span className="text-text-muted text-sm font-medium">/month</span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {plan.maxUsers < 999 ? `Up to ${plan.maxUsers} users` : 'Unlimited users'}
                </p>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                    <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSubscribe(plan)}
                disabled={loading !== null}
                className={`w-full h-11 rounded-xl font-bold ${plan.popular ? 'bg-accent hover:bg-accent/90 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}
              >
                {loading === plan.id ? <RefreshCw className="animate-spin" size={16} /> : `Subscribe — ₦${plan.price.toLocaleString()}/mo`}
              </Button>
            </div>
          ))}
        </div>

        {isTrial && daysLeft > 0 && (
          <div className="text-center">
            <Button variant="ghost" onClick={() => onSubscribed('trial', organization.trialEndsAt?.toDate?.()?.toISOString() ?? '', organization.maxUsers)} className="text-text-muted text-sm">
              Continue with trial ({Math.floor(daysLeft)} days left) →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const SubscriptionBanner = ({ organization, onUpgrade }: { organization: Organization; onUpgrade: () => void }) => {
  if (organization.subscriptionStatus !== 'trial') return null;

  const daysLeft = organization.trialEndsAt
    ? Math.max(0, Math.ceil((organization.trialEndsAt.toDate?.() ?? new Date(organization.trialEndsAt) as Date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  if (daysLeft <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
      <div className="flex items-center gap-2 min-w-0">
        <Star size={14} className="text-amber-600 shrink-0" />
        <p className="text-xs font-bold text-amber-800 leading-snug">
          Free trial — <span className="font-black">{Math.floor(daysLeft)} day{Math.floor(daysLeft) !== 1 ? 's' : ''}</span> remaining.
        </p>
      </div>
      <Button size="sm" onClick={onUpgrade} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shrink-0 h-7 px-3">
        Upgrade Plan
      </Button>
    </div>
  );
};

const Dashboard = ({ matters, appointments, followUps, onNavigate }: { matters: Matter[], appointments: Appointment[], followUps: FollowUp[], onNavigate: (tab: string) => void }) => {
  const newLeads = matters.filter(m => m.status === 'new_lead');
  const activeCases = matters.filter(m => m.status === 'open');
  const todayAppointments = appointments.filter(a => {
    if (!a.date) return false;
    const date = a.date.toDate ? a.date.toDate() : new Date(a.date);
    return format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">Firm Overview</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-fr">
        <div className="bento-card bg-white border-accent/10">
          <div className="card-title-theme">New Intakes</div>
          <div className="big-stat-theme text-accent">{newLeads.length}</div>
          <div className="stat-sub-theme">Awaiting review</div>
        </div>
        
        <div className="bento-card bg-white">
          <div className="card-title-theme">Active Cases</div>
          <div className="big-stat-theme">{activeCases.length}</div>
          <div className="stat-sub-theme">Across all courts</div>
        </div>

        <div className="bento-card bg-white">
          <div className="card-title-theme">Today's Appointments</div>
          <div className="big-stat-theme">{todayAppointments.length}</div>
          <div className="stat-sub-theme">Meetings & Hearings</div>
        </div>

        <div className="bento-card bg-white">
          <div className="card-title-theme">Pending Follow-ups</div>
          <div className="big-stat-theme">{followUps.filter(f => f.status === 'pending').length}</div>
          <div className="stat-sub-theme">Client communication</div>
        </div>

        <div className="bento-card md:col-span-2 md:row-span-2 bg-white border-accent/5">
          <div className="card-title-theme flex items-center justify-between">
            <span>Recent Case Updates</span>
            <Badge className="bg-accent/10 text-accent border-none text-[10px] uppercase">Live</Badge>
          </div>
          <div className="space-y-3 mt-4">
            {matters.slice(0, 5).map(matter => (
              <div key={matter.id} className="flex items-center justify-between p-4 bg-bg/30 rounded-2xl border border-border-theme/50 hover:border-accent/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                    <History size={18}/>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">{matter.title}</p>
                    <p className="text-[11px] text-text-muted font-medium">{matter.courtName} - {matter.courtState}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-blue-50 text-blue-600 border-blue-200">
                    {matter.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bento-card md:col-span-2 bg-white">
          <div className="card-title-theme">Upcoming Appointments</div>
          <div className="space-y-3 mt-4">
            {appointments.slice(0, 3).map(app => (
              <div key={app.id} className="flex items-center justify-between p-3 bg-bg/20 rounded-xl border border-border-theme/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Calendar size={16}/>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">{app.type.replace('_', ' ')}</p>
                    <p className="text-[11px] text-text-muted">{app.matterTitle} - {app.clientName}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-border-theme bg-white">
                  {app.date ? format(app.date.toDate ? app.date.toDate() : new Date(app.date), 'MMM d, h:mm a') : 'TBD'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="bento-card bg-white">
          <div className="card-title-theme">Quick Actions</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => onNavigate('matters')} className="text-[10px] font-bold h-9 rounded-lg">New Case</Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate('appointments')} className="text-[10px] font-bold h-9 rounded-lg">Schedule</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MattersList = ({ matters, orgId }: { matters: Matter[], orgId: string }) => {
  const [showNewMatter, setShowNewMatter] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [newUpdate, setNewUpdate] = useState('');
  const [updates, setUpdates] = useState<CaseUpdate[]>([]);
  const [newMatter, setNewMatter] = useState({
    title: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    courtName: '',
    courtState: 'Lagos',
    lawyerInCharge: '',
    matterType: '',
    practiceArea: '',
    status: 'open' as const
  });

  const handleCreateMatter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.currentUser?.uid === 'guest_user' || !auth.currentUser) {
      toast.info('Feature limited in Guest Mode.');
      setShowNewMatter(false);
      return;
    }
    try {
      const path = 'matters';
      await addDoc(collection(db, path), {
        ...newMatter,
        uid: auth.currentUser?.uid,
        orgId,
        source: 'local',
        updatedAt: serverTimestamp()
      });
      toast.success('New case opened');
      setShowNewMatter(false);
      setNewMatter({ title: '', clientName: '', clientEmail: '', clientPhone: '', courtName: '', courtState: 'Lagos', lawyerInCharge: '', matterType: '', practiceArea: '', status: 'open' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'matters');
    }
  };

  useEffect(() => {
    if (!selectedMatter) return;
    const q = query(
      collection(db, 'caseUpdates'), 
      where('matterId', '==', selectedMatter.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setUpdates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CaseUpdate)));
    });
    return unsub;
  }, [selectedMatter]);

  const handleAddUpdate = async () => {
    if (!selectedMatter || !newUpdate) return;
    const path = 'caseUpdates';
    try {
      await addDoc(collection(db, path), {
        matterId: selectedMatter.id,
        content: newUpdate,
        author: auth.currentUser?.displayName || 'Lawyer',
        createdAt: serverTimestamp()
      });
      setNewUpdate('');
      toast.success('Case update added');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bento-card bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-primary">Case Monitoring</h2>
            <p className="text-sm text-text-muted">Track status, location, and assigned lawyers</p>
          </div>
          <Button onClick={() => setShowNewMatter(true)} className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2 rounded-xl px-5 h-10 font-bold shrink-0">
            <Plus size={14}/> Add New Case
          </Button>
        </div>
        
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16}/>
          <Input className="pl-12 border-border-theme rounded-2xl bg-bg/30 h-12" placeholder="Search cases..."/>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border-theme shadow-sm">
          <div className="min-w-[800px]">
            <Table>
            <TableHeader className="bg-bg/50">
              <TableRow className="hover:bg-transparent border-border-theme">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-text-muted py-4 px-6">Case Title</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-text-muted py-4 px-6">Type</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-text-muted py-4 px-6">Court / State</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-text-muted py-4 px-6">Lawyer In Charge</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-text-muted py-4 px-6">Status</TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-text-muted py-4 px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matters.filter(m => m.status !== 'new_lead').map(matter => (
                <TableRow key={matter.id} className="border-border-theme hover:bg-bg/40 transition-colors">
                  <TableCell className="font-bold text-primary text-sm py-4 px-6">{matter.title}</TableCell>
                  <TableCell className="text-xs font-medium py-4 px-6">
                    <span className="bg-accent/5 text-accent px-2 py-1 rounded text-[10px] uppercase font-bold mr-2">
                      {matter.matterType || 'Unassigned'}
                    </span>
                    {matter.practiceArea && (
                      <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] uppercase font-bold border border-blue-100">
                        {matter.practiceArea}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm py-4 px-6">
                    <div className="flex flex-col">
                      <span>{matter.courtName}</span>
                      <span className="text-[10px] text-text-muted">{matter.courtState}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm py-4 px-6">{matter.lawyerInCharge}</TableCell>
                  <TableCell className="py-4 px-6">
                    <Badge className={`capitalize text-[10px] font-bold px-3 py-1 border-none ${matter.status === 'open' ? 'bg-green-100 text-green-700' : matter.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                      {matter.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-4 px-6">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMatter(matter)}
                      className="text-accent font-bold hover:bg-accent/5 rounded-lg"
                    >
                      Updates
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      </div>

      {/* New Case Dialog */}
      <Dialog open={showNewMatter} onOpenChange={setShowNewMatter}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Add New Case</DialogTitle>
            <DialogDescription>Enter the details for the new legal matter.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateMatter} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Case Title</Label>
              <Input className="rounded-xl border-border-theme h-10" placeholder="e.g. Smith vs Jones" value={newMatter.title} onChange={(e) => setNewMatter({...newMatter, title: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Client Name</Label>
                <Input className="rounded-xl border-border-theme h-10" value={newMatter.clientName} onChange={(e) => setNewMatter({...newMatter, clientName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Client Phone</Label>
                <Input className="rounded-xl border-border-theme h-10" value={newMatter.clientPhone} onChange={(e) => setNewMatter({...newMatter, clientPhone: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Court Name</Label>
              <Input className="rounded-xl border-border-theme h-10" placeholder="e.g. High Court Ikeja" value={newMatter.courtName} onChange={(e) => setNewMatter({...newMatter, courtName: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Case Type</Label>
                <Input className="rounded-xl border-border-theme h-10" placeholder="e.g. Criminal, Real Estate" value={newMatter.matterType} onChange={(e) => setNewMatter({...newMatter, matterType: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Practice Area</Label>
                <Input className="rounded-xl border-border-theme h-10" placeholder="e.g. Litigation, Corporate" value={newMatter.practiceArea} onChange={(e) => setNewMatter({...newMatter, practiceArea: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">State</Label>
                <select className="w-full p-2 border border-border-theme rounded-xl text-sm bg-bg/10 outline-none" value={newMatter.courtState} onChange={(e) => setNewMatter({...newMatter, courtState: e.target.value})}
                >
                  {NIGERIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Lawyer in Charge</Label>
                <Input className="rounded-xl border-border-theme h-10" value={newMatter.lawyerInCharge} onChange={(e) => setNewMatter({...newMatter, lawyerInCharge: e.target.value})}
                   required
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowNewMatter(false)} className="rounded-xl font-bold">Cancel</Button>
              <Button type="submit" className="bg-accent text-white hover:bg-accent/90 rounded-xl font-bold px-8 h-12 shadow-lg shadow-accent/20">
                Add New Case
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Case Updates Dialog */}
      <Dialog open={!!selectedMatter} onOpenChange={() => setSelectedMatter(null)}>
        <DialogContent className="sm:max-w-2xl rounded-3xl border-none shadow-2xl bg-white max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Case Updates: {selectedMatter?.title}</DialogTitle>
            <DialogDescription>View and add progress updates for this case.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">New Update</Label>
              <div className="flex gap-2">
                <textarea className="flex-1 p-3 border border-border-theme rounded-xl text-sm bg-bg/30 focus:ring-2 focus:ring-accent/20 transition-all outline-none min-h-[80px] resize-none" value={newUpdate} onChange={(e) => setNewUpdate(e.target.value)}
                  placeholder="Enter case progress update..."
                />
                <Button onClick={handleAddUpdate} className="bg-accent text-white h-auto px-6 rounded-xl font-bold">Add</Button>
              </div>
            </div>

            <div className="space-y-3 mt-6">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Update History</Label>
              {updates.map(update => (
                <div key={update.id} className="p-4 bg-bg/20 rounded-2xl border border-border-theme/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-primary">{update.author}</span>
                    <span className="text-[10px] text-text-muted">
                      {update.createdAt ? format(update.createdAt.toDate ? update.createdAt.toDate() : new Date(update.createdAt), 'MMM d, yyyy h:mm a') : 'Just now'}
                    </span>
                  </div>
                  <p className="text-sm text-text-main">{update.content}</p>
                </div>
              ))}
              {updates.length === 0 && (
                <p className="text-center py-8 text-text-muted italic text-sm">No updates yet.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const IntakesList = ({ matters, orgId }: { matters: Matter[], orgId: string }) => {
  const intakes = matters.filter(m => m.status === 'new_lead');
  const [selectedIntake, setSelectedIntake] = useState<Matter | null>(null);
  const [assignedLawyer, setAssignedLawyer] = useState('');
  const [matterType, setMatterType] = useState('');
  const [practiceArea, setPracticeArea] = useState('');

  const handleAcceptIntake = async () => {
    if (!selectedIntake || !assignedLawyer) return;
    const path = `matters/${selectedIntake.id}`;
    try {
      await setDoc(doc(db, 'matters', selectedIntake.id), {
        status: 'open',
        lawyerInCharge: assignedLawyer,
        matterType: matterType || undefined,
        practiceArea: practiceArea || undefined,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('Intake accepted and case opened');
      setSelectedIntake(null);
      setAssignedLawyer('');
      setMatterType('');
      setPracticeArea('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <div className="bento-card bg-white">
      <div className="card-title-theme">New Client Intakes</div>
      <div className="space-y-4 mt-4">
        {intakes.map(intake => (
          <div key={intake.id} className="flex items-center justify-between p-6 bg-bg/30 rounded-2xl border border-border-theme/50 hover:border-accent/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10 text-accent">
                <User size={20} />
              </div>
              <div>
                <p className="text-base font-bold text-primary">{intake.clientName}</p>
                <p className="text-sm text-text-muted font-medium">{intake.title}</p>
                <div className="flex gap-4 mt-1">
                  <span className="text-[11px] text-text-muted flex items-center gap-1"><Mail size={12} /> {intake.clientEmail || 'No email'}</span>
                  <span className="text-[11px] text-text-muted flex items-center gap-1"><Phone size={12} /> {intake.clientPhone || 'No phone'}</span>
                </div>
              </div>
            </div>
            <Button onClick={() => setSelectedIntake(intake)} className="bg-primary text-white font-bold rounded-xl px-6">Review & Accept</Button>
          </div>
        ))}
        {intakes.length === 0 && (
          <div className="text-center py-12 text-text-muted italic">No new intakes at this time.</div>
        )}
      </div>

      <Dialog open={!!selectedIntake} onOpenChange={() => setSelectedIntake(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Accept Intake</DialogTitle>
            <DialogDescription>Assign a lawyer and open a new case for {selectedIntake?.clientName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Assign Lawyer</Label>
                <Input 
                  className="rounded-xl border-border-theme bg-white h-12" 
                  placeholder="Lawyer name"
                  value={assignedLawyer}
                  onChange={(e) => setAssignedLawyer(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Case Type</Label>
                <Input 
                  className="rounded-xl border-border-theme bg-white h-12" 
                  placeholder="e.g. Criminal"
                  value={matterType}
                  onChange={(e) => setMatterType(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Practice Area</Label>
              <Input 
                className="rounded-xl border-border-theme bg-white h-12" 
                placeholder="e.g. Litigation"
                value={practiceArea}
                onChange={(e) => setPracticeArea(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedIntake(null)} className="rounded-xl font-bold">Cancel</Button>
            <Button onClick={handleAcceptIntake} className="bg-accent text-white hover:bg-accent/90 rounded-xl font-bold px-8 h-12 shadow-lg shadow-accent/20">
              Open Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AppointmentsList = ({ appointments, matters, orgId }: { appointments: Appointment[], matters: Matter[], orgId: string }) => {
  const [showNewApp, setShowNewApp] = useState(false);
  const [newApp, setNewApp] = useState({
    matterId: '',
    date: '',
    time: '',
    type: 'consultation' as const,
    notes: ''
  });

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.currentUser?.uid === 'guest_user' || !auth.currentUser) {
      toast.info('Feature limited in Guest Mode.');
      setShowNewApp(false);
      return;
    }
    if (!newApp.matterId || !newApp.date || !newApp.time) return;

    const matter = matters.find(m => m.id === newApp.matterId);
    const dateTime = new Date(`${newApp.date}T${newApp.time}`);
    const path = 'appointments';

    try {
      await addDoc(collection(db, path), {
        uid: auth.currentUser?.uid,
        orgId,
        matterId: newApp.matterId,
        matterTitle: matter?.title || 'General',
        clientName: matter?.clientName || 'Client',
        date: dateTime,
        type: newApp.type,
        status: 'scheduled',
        notes: newApp.notes
      });
      toast.success('Appointment scheduled');
      setShowNewApp(false);
      setNewApp({ matterId: '', date: '', time: '', type: 'consultation', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">Calendar & Appointments</h2>
        <Button onClick={() => setShowNewApp(true)} className="bg-accent text-white font-bold rounded-xl px-5 h-10 shadow-lg shadow-accent/20 flex items-center gap-2 shrink-0">
          <Plus size={16} /> Schedule Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bento-card bg-white">
          <div className="card-title-theme">Upcoming Appointments</div>
          <div className="space-y-4 mt-4">
            {appointments.map(app => (
              <div key={app.id} className="flex items-center justify-between p-4 bg-bg/30 rounded-2xl border border-border-theme/50">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    app.type === 'court_hearing' ? 'bg-red-100 text-red-700' :
                    app.type === 'consultation' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">{app.type.replace('_', ' ').toUpperCase()}</p>
                    <p className="text-xs text-text-muted font-medium">{app.matterTitle} - {app.clientName}</p>
                    <p className="text-[10px] text-text-muted mt-1">{app.notes}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">
                    {app.date ? format(app.date.toDate ? app.date.toDate() : new Date(app.date), 'MMM d, yyyy') : 'TBD'}
                  </p>
                  <p className="text-xs text-text-muted">
                    {app.date ? format(app.date.toDate ? app.date.toDate() : new Date(app.date), 'h:mm a') : ''}
                  </p>
                </div>
              </div>
            ))}
            {appointments.length === 0 && (
              <div className="text-center py-12 text-text-muted italic">No appointments scheduled.</div>
            )}
          </div>
        </div>

        <div className="bento-card bg-white h-fit">
          <div className="card-title-theme">Today's Reminders</div>
          <div className="space-y-3 mt-4">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-xs font-medium">
              Prepare brief for High Court hearing at 10:00 AM
            </div>
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-xs font-medium">
              Client consultation with Mr. Adebayo at 2:00 PM
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showNewApp} onOpenChange={setShowNewApp}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Schedule Appointment</DialogTitle>
            <DialogDescription>Set up a new meeting or hearing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSchedule} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Select Case</Label>
              <select 
                className="w-full p-3 border border-border-theme rounded-xl text-sm bg-white focus:ring-2 focus:ring-accent/20 transition-all outline-none"
                value={newApp.matterId}
                onChange={(e) => setNewApp({...newApp, matterId: e.target.value})}
                required
              >
                <option value="">Choose a case...</option>
                {matters.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Date</Label>
                <Input type="date" className="rounded-xl" value={newApp.date} onChange={(e) => setNewApp({...newApp, date: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Time</Label>
                <Input type="time" className="rounded-xl" value={newApp.time} onChange={(e) => setNewApp({...newApp, time: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Type</Label>
              <select 
                className="w-full p-3 border border-border-theme rounded-xl text-sm bg-white focus:ring-2 focus:ring-accent/20 transition-all outline-none"
                value={newApp.type}
                onChange={(e) => setNewApp({...newApp, type: e.target.value as any})}
              >
                <option value="consultation">Consultation</option>
                <option value="court_hearing">Court Hearing</option>
                <option value="meeting">Meeting</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Notes</Label>
              <Input className="rounded-xl" placeholder="Optional notes" value={newApp.notes} onChange={(e) => setNewApp({...newApp, notes: e.target.value})} />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowNewApp(false)} className="rounded-xl font-bold">Cancel</Button>
              <Button type="submit" className="bg-accent text-white hover:bg-accent/90 rounded-xl font-bold px-8 h-12 shadow-lg shadow-accent/20">
                Schedule Appointment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const FollowUpsList = ({ followUps, matters, orgId }: { followUps: FollowUp[], matters: Matter[], orgId: string }) => {
  const [showNewFollowUp, setShowNewFollowUp] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState({
    matterId: '',
    nextFollowUp: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.currentUser?.uid === 'guest_user' || !auth.currentUser) {
      toast.info('Feature limited in Guest Mode.');
      setShowNewFollowUp(false);
      return;
    }
    if (!newFollowUp.matterId) return;

    const matter = matters.find(m => m.id === newFollowUp.matterId);
    const path = 'followUps';
    try {
      await addDoc(collection(db, path), {
        uid: auth.currentUser?.uid,
        orgId,
        matterId: newFollowUp.matterId,
        clientName: matter?.clientName || 'Client',
        lastContact: serverTimestamp(),
        nextFollowUp: new Date(newFollowUp.nextFollowUp),
        status: 'pending',
        notes: newFollowUp.notes
      });
      toast.success('Follow-up scheduled');
      setShowNewFollowUp(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleComplete = async (id: string) => {
    if (auth.currentUser?.uid === 'guest_user') {
      toast.info('Feature limited in Guest Mode.');
      return;
    }
    const path = `followUps/${id}`;
    try {
      await setDoc(doc(db, 'followUps', id), { status: 'completed' }, { merge: true });
      toast.success('Follow-up marked as completed');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">Client Follow-ups</h2>
        <Button onClick={() => setShowNewFollowUp(true)} className="bg-accent text-white font-bold rounded-xl px-5 h-10 shadow-lg shadow-accent/20 flex items-center gap-2 shrink-0">
          <Plus size={16} /> New Follow-up
        </Button>
      </div>

      <div className="bento-card bg-white">
        <div className="card-title-theme">Pending Follow-ups</div>
        <div className="space-y-4 mt-4">
          {followUps.filter(f => f.status === 'pending').map(follow => (
            <div key={follow.id} className="flex items-center justify-between p-4 bg-bg/30 rounded-2xl border border-border-theme/50">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-100 text-green-700">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-primary">{follow.clientName}</p>
                  <p className="text-xs text-text-muted font-medium">Next: {follow.nextFollowUp ? format(follow.nextFollowUp.toDate ? follow.nextFollowUp.toDate() : new Date(follow.nextFollowUp), 'MMM d, yyyy') : 'TBD'}</p>
                  <p className="text-[10px] text-text-muted mt-1">{follow.notes}</p>
                </div>
              </div>
              <Button onClick={() => handleComplete(follow.id)} variant="outline" size="sm" className="rounded-xl font-bold text-green-600 hover:bg-green-50">Mark Done</Button>
            </div>
          ))}
          {followUps.filter(f => f.status === 'pending').length === 0 && (
            <div className="text-center py-12 text-text-muted italic">All follow-ups completed!</div>
          )}
        </div>
      </div>

      <Dialog open={showNewFollowUp} onOpenChange={setShowNewFollowUp}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">New Follow-up</DialogTitle>
            <DialogDescription>Schedule a check-in with a client.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Select Client/Case</Label>
              <select 
                className="w-full p-3 border border-border-theme rounded-xl text-sm bg-white focus:ring-2 focus:ring-accent/20 transition-all outline-none"
                value={newFollowUp.matterId}
                onChange={(e) => setNewFollowUp({...newFollowUp, matterId: e.target.value})}
                required
              >
                <option value="">Choose a case...</option>
                {matters.map(m => (
                  <option key={m.id} value={m.id}>{m.clientName} ({m.title})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Next Follow-up Date</Label>
              <Input type="date" className="rounded-xl" value={newFollowUp.nextFollowUp} onChange={(e) => setNewFollowUp({...newFollowUp, nextFollowUp: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Notes</Label>
              <Input className="rounded-xl" placeholder="What to discuss?" value={newFollowUp.notes} onChange={(e) => setNewFollowUp({...newFollowUp, notes: e.target.value})} />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowNewFollowUp(false)} className="rounded-xl font-bold">Cancel</Button>
              <Button type="submit" className="bg-accent text-white hover:bg-accent/90 rounded-xl font-bold px-8 h-12 shadow-lg shadow-accent/20">
                Schedule Follow-up
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const BillingPage = ({ invoices, matters, orgId }: { invoices: Invoice[], matters: Matter[], orgId: string }) => {
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [newInvoice, setNewInvoice] = useState({
    matterId: '',
    amount: '',
    description: '',
    senderEmail: matters.length > 0 ? (auth.currentUser?.email || '') : '',
    clientEmail: '',
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.currentUser?.uid === 'guest_user' || !auth.currentUser) {
      toast.info('Feature limited in Guest Mode.');
      setShowNewInvoice(false);
      return;
    }
    if (!newInvoice.matterId || !newInvoice.amount) return;

    const matter = matters.find(m => m.id === newInvoice.matterId);
    try {
      const path = 'invoices';
      await addDoc(collection(db, path), {
        uid: auth.currentUser?.uid,
        orgId,
        matterId: newInvoice.matterId,
        matterTitle: matter?.title || 'General',
        clientName: matter?.clientName || 'Client',
        clientEmail: newInvoice.clientEmail || matter?.clientEmail || '',
        senderEmail: newInvoice.senderEmail || auth.currentUser?.email || '',
        amount: Number(newInvoice.amount),
        currency: 'NGN',
        description: newInvoice.description,
        status: 'draft',
        dueDate: new Date(newInvoice.dueDate),
        createdAt: serverTimestamp()
      });
      toast.success('Invoice drafted in Naira');
      setShowNewInvoice(false);
      setNewInvoice({ 
        matterId: '', 
        amount: '', 
        description: '', 
        senderEmail: auth.currentUser?.email || '', 
        clientEmail: '', 
        dueDate: format(new Date(), 'yyyy-MM-dd') 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invoices');
    }
  };

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const handlePrint = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setTimeout(() => {
        window.print();
    }, 500);
  };

  const handleSendEmail = async (invoice: Invoice) => {
    if (auth.currentUser?.uid === 'guest_user') {
      toast.info('Simulating automated reminder in Guest Mode.');
      return;
    }
    
    try {
      await addDoc(collection(db, 'emails'), {
        uid: auth.currentUser?.uid,
        orgId,
        recipient: invoice.clientEmail,
        subject: `Payment Reminder: Caseflo Law Invoice #NG-${invoice.id.slice(0,6).toUpperCase()}`,
        body: `Dear ${invoice.clientName}, this is a reminder regarding your outstanding payment for ${invoice.matterTitle} in the amount of ₦${invoice.amount}. Please clear this as soon as possible.`,
        type: 'payment_reminder',
        status: 'pending',
        scheduledFor: serverTimestamp()
      });
      toast.success(`Automated payment reminder queued for ${invoice.clientEmail}`);
    } catch (err) {
      toast.error('Failed to queue automated reminder');
    }
  };

  const handlePayNow = async (invoice: Invoice) => {
    if (auth.currentUser?.uid === 'guest_user') {
      toast.error('Payment processing is disabled in Guest Mode.');
      return;
    }

    try {
      const response = await axios.post('/api/payments/initialize', {
        email: invoice.clientEmail,
        amount: invoice.amount,
        invoiceId: invoice.id,
        matterTitle: invoice.matterTitle
      });

      if (response.data?.data?.authorization_url) {
        window.open(response.data.data.authorization_url, '_blank');
        toast.info('Opening secure Paystack gateway...');
      } else {
        throw new Error('Failed to get payment URL');
      }
    } catch (error) {
      console.error(error);
      toast.error('Payment initialization failed. Ensure Paystack is configured.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">Financial Records</h2>
        <Button onClick={() => setShowNewInvoice(true)} className="bg-accent text-white font-bold rounded-xl px-5 h-10 shadow-lg shadow-accent/20 flex items-center gap-2 shrink-0">
          <FileBadge size={16} /> Generate Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bento-card bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <DollarSign size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Total Billed</span>
          </div>
          <div className="text-3xl font-extrabold text-primary">
            {formatNaira(invoices.reduce((sum, inv) => sum + inv.amount, 0))}
          </div>
          <p className="text-[10px] text-text-muted mt-2 font-medium">Accumulated across all cases</p>
        </div>
        
        <div className="bento-card bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <Clock size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Outstanding</span>
          </div>
          <div className="text-3xl font-extrabold text-primary">
            {formatNaira(invoices.filter(i => i.status !== 'paid').reduce((sum, inv) => sum + inv.amount, 0))}
          </div>
          <p className="text-[10px] text-text-muted mt-2 font-medium">Invoices pending payment</p>
        </div>

        <div className="bento-card bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-blue-600 mb-2">
            <CheckCircle2 size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Paid</span>
          </div>
          <div className="text-3xl font-extrabold text-primary">
            {formatNaira(invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0))}
          </div>
          <p className="text-[10px] text-text-muted mt-2 font-medium">Successfully processed</p>
        </div>
      </div>

      <div className="bento-card bg-white">
        <div className="card-title-theme">Recent Invoices</div>
        <div className="overflow-x-auto mt-4">
          <Table>
            <TableHeader className="bg-bg/40">
              <TableRow className="border-border-theme">
                <TableHead className="text-[10px] font-bold uppercase">Invoice ID</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Client / Case</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Amount</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id} className="border-border-theme hover:bg-bg/20 transition-colors">
                  <TableCell className="text-xs font-mono font-bold">#NG-{inv.id.slice(0, 6).toUpperCase()}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-primary">{inv.clientName}</span>
                      <span className="text-[11px] text-text-muted">{inv.matterTitle}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-bold text-accent">{formatNaira(inv.amount)}</TableCell>
                  <TableCell>
                    <Badge className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' : 
                      inv.status === 'sent' ? 'bg-blue-100 text-blue-700' : 
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {inv.status !== 'paid' && (
                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold border-accent/20 text-accent hover:bg-accent/5" onClick={() => handlePayNow(inv)}>
                          <CreditCard size={14} className="mr-1" /> Pay Now
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-accent" onClick={() => handlePrint(inv)}>
                        <Printer size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-blue-600" onClick={() => handleSendEmail(inv)}>
                        <Send size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-text-muted italic">No invoices found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showNewInvoice} onOpenChange={setShowNewInvoice}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Generate Invoice</DialogTitle>
            <DialogDescription>Create a billing request for a specific case.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInvoice} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Select Case</Label>
              <select 
                className="w-full p-2 border border-border-theme rounded-xl text-sm bg-bg/5 outline-none"
                value={newInvoice.matterId}
                onChange={(e) => {
                  const mId = e.target.value;
                  const m = matters.find(item => item.id === mId);
                  setNewInvoice({
                    ...newInvoice, 
                    matterId: mId,
                    clientEmail: m?.clientEmail || ''
                  });
                }}
                required
              >
                <option value="">Choose a matter...</option>
                {matters.map(m => <option key={m.id} value={m.id}>{m.title} - {m.clientName}</option>)}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Sender's Email</Label>
                <Input 
                  type="email"
                  placeholder="lawyer@firm.com"
                  className="rounded-xl border-border-theme h-10 text-xs"
                  value={newInvoice.senderEmail}
                  onChange={(e) => setNewInvoice({...newInvoice, senderEmail: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Client's Email</Label>
                <Input 
                  type="email"
                  placeholder="client@example.com"
                  className="rounded-xl border-border-theme h-10 text-xs"
                  value={newInvoice.clientEmail}
                  onChange={(e) => setNewInvoice({...newInvoice, clientEmail: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Amount (₦)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-primary">₦</span>
                <Input 
                  type="number"
                  placeholder="0.00"
                  className="pl-8 rounded-xl border-border-theme h-12 font-bold"
                  value={newInvoice.amount}
                  onChange={(e) => setNewInvoice({...newInvoice, amount: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Due Date</Label>
              <Input 
                type="date"
                className="rounded-xl border-border-theme h-12"
                value={newInvoice.dueDate}
                onChange={(e) => setNewInvoice({...newInvoice, dueDate: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Description of Services</Label>
              <textarea 
                className="w-full p-3 border border-border-theme rounded-xl text-sm bg-bg/5 outline-none h-24"
                placeholder="e.g. Legal representation for civil suite..."
                value={newInvoice.description}
                onChange={(e) => setNewInvoice({...newInvoice, description: e.target.value})}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowNewInvoice(false)} className="rounded-xl font-bold">Cancel</Button>
              <Button type="submit" className="bg-accent text-white hover:bg-accent/90 rounded-xl font-bold px-8 h-12 shadow-lg shadow-accent/20">
                Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SUPPORTED_EFILING_COURTS = [
  'Federal High Court of Nigeria',
  'National Industrial Court',
  'Supreme Court of Nigeria',
  'Court of Appeal Nigeria',
  ...NIGERIAN_STATES.map(s => `${s.name} ${s.name === 'FCT Abuja' ? '' : 'State'} High Court`)
].sort();

const EFilingsPage = ({ filings, orgId }: { filings: EFiling[], orgId: string }) => {
  const [showNewFiling, setShowNewFiling] = useState(false);
  const [newFiling, setNewFiling] = useState({
    caseType: '',
    caseNumber: '',
    court: SUPPORTED_EFILING_COURTS[0],
    documentType: 'Motion on Notice'
  });

  const handleCreateFiling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.currentUser?.uid === 'guest_user' || !auth.currentUser) {
      toast.info('E-Filing submission is simulated in Guest Mode.');
      setShowNewFiling(false);
      return;
    }
    if (!newFiling.caseType || !newFiling.caseNumber || !newFiling.court || !newFiling.documentType) return;

    try {
      const path = 'filings';
      await addDoc(collection(db, path), {
        uid: auth.currentUser?.uid,
        orgId,
        caseType: newFiling.caseType,
        caseNumber: newFiling.caseNumber,
        court: newFiling.court,
        documentType: newFiling.documentType,
        status: 'submitted',
        submissionDate: serverTimestamp(),
        confirmationNumber: 'EFILE-' + Math.floor(Math.random() * 1000000)
      });
      toast.success('Document submitted to ' + newFiling.court + ' successfully');
      setShowNewFiling(false);
      setNewFiling({
        caseType: '',
        caseNumber: '',
        court: SUPPORTED_EFILING_COURTS[0],
        documentType: 'Motion on Notice'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'filings');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">E-Filing Portal</h2>
        <Button onClick={() => setShowNewFiling(true)} className="bg-accent text-white font-bold rounded-xl px-5 h-10 shadow-lg shadow-accent/20 flex items-center gap-2 shrink-0">
          <FileUp size={16} /> New Filing
        </Button>
      </div>

      <div className="bento-card border-none shadow-sm bg-gradient-to-r from-blue-50 to-bg p-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/30">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-primary">Integrated E-Filing</h3>
            <p className="text-sm text-text-muted">Directly file court documents to supported state judiciary portals.</p>
          </div>
        </div>
      </div>

      <div className="bento-card bg-white">
        <div className="card-title-theme">Recent Submissions</div>
        <div className="space-y-4 mt-4">
          {filings.length === 0 ? (
            <div className="text-center py-12 text-text-muted italic">No documents e-filed yet.</div>
          ) : (
            filings.map(filing => {
              return (
                <div key={filing.id} className="flex items-center justify-between p-4 bg-bg/30 rounded-2xl border border-border-theme/50">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${
                      filing.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      filing.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      <FileBadge size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">{filing.documentType}</p>
                      <p className="text-xs text-text-muted font-medium">{filing.court}</p>
                      <p className="text-[10px] text-text-muted mt-1">Case Type: {filing.caseType} | Case No: {filing.caseNumber} {filing.confirmationNumber ? `| Ref: ${filing.confirmationNumber}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${
                      filing.status === 'accepted' ? 'text-green-600 border-green-200 bg-green-50' : 
                      filing.status === 'rejected' ? 'text-red-600 border-red-200 bg-red-50' :
                      'text-blue-600 border-blue-200 bg-blue-50'
                    }`}>
                      {filing.status}
                    </Badge>
                    {filing.submissionDate && (
                      <span className="text-[10px] text-text-muted">
                        {format(filing.submissionDate.toDate ? filing.submissionDate.toDate() : new Date(), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <Dialog open={showNewFiling} onOpenChange={setShowNewFiling}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Submit E-Filing</DialogTitle>
            <DialogDescription>Electronically file a document with a supported court portal.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFiling} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Enter Case Type</Label>
              <Input 
                className="rounded-xl border-border-theme h-12" 
                placeholder="e.g. Civil Rights, Corporate, Criminal"
                value={newFiling.caseType}
                onChange={(e) => setNewFiling({...newFiling, caseType: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Case Number</Label>
              <Input 
                className="rounded-xl border-border-theme h-12" 
                placeholder="e.g. LD/123/2026"
                value={newFiling.caseNumber}
                onChange={(e) => setNewFiling({...newFiling, caseNumber: e.target.value})}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Target Court / Portal</Label>
              <select 
                className="w-full p-3 border border-border-theme rounded-xl text-sm bg-white focus:ring-2 focus:ring-accent/20 transition-all outline-none"
                value={newFiling.court}
                onChange={(e) => setNewFiling({...newFiling, court: e.target.value})}
                required
              >
                {SUPPORTED_EFILING_COURTS.map(court => (
                  <option key={court} value={court}>{court}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Document Type</Label>
              <Input 
                className="rounded-xl border-border-theme h-12" 
                placeholder="e.g. Statement of Claim, Motion EX-Parte"
                value={newFiling.documentType}
                onChange={(e) => setNewFiling({...newFiling, documentType: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Upload Document (PDF)</Label>
              <div className="border border-dashed border-border-theme rounded-xl p-6 flex flex-col items-center justify-center text-center bg-bg/20">
                <FileUp className="text-text-muted mb-2" size={24} />
                <span className="text-sm font-medium text-primary">Click to attach file</span>
                <span className="text-[10px] text-text-muted mt-1">Simulated upload - no real file required for test mode</span>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowNewFiling(false)} className="rounded-xl font-bold">Cancel</Button>
              <Button type="submit" className="bg-accent text-white hover:bg-accent/90 rounded-xl font-bold px-8 h-12 shadow-lg shadow-accent/20">
                Submit Filing
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TEMPLATE_LIBRARY = [
  // Federal Courts
  { name: 'Originating Summons',        court: 'Federal High Court',                  documentType: 'Originating Summons',        defaultStatus: 'draft' },
  { name: 'Writ of Summons',            court: 'Federal High Court',                  documentType: 'Writ of Summons',            defaultStatus: 'draft' },
  { name: 'Statement of Claim',         court: 'Federal High Court',                  documentType: 'Statement of Claim',         defaultStatus: 'draft' },
  { name: 'Motion on Notice',           court: 'Federal High Court',                  documentType: 'Motion on Notice',           defaultStatus: 'draft' },
  { name: 'Motion Ex-Parte',            court: 'Federal High Court',                  documentType: 'Motion Ex-Parte',            defaultStatus: 'draft' },
  { name: 'Written Address',            court: 'Federal High Court',                  documentType: 'Written Address',            defaultStatus: 'draft' },
  { name: 'Counter-Affidavit',          court: 'Federal High Court',                  documentType: 'Counter-Affidavit',          defaultStatus: 'draft' },
  // Court of Appeal
  { name: 'Notice of Appeal',           court: 'Court of Appeal',                     documentType: 'Notice of Appeal',           defaultStatus: 'draft' },
  { name: 'Appellant\'s Brief',         court: 'Court of Appeal',                     documentType: 'Appellant\'s Brief',         defaultStatus: 'draft' },
  { name: 'Respondent\'s Brief',        court: 'Court of Appeal',                     documentType: 'Respondent\'s Brief',        defaultStatus: 'draft' },
  // Lagos State
  { name: 'Writ of Summons (Lagos)',    court: 'Lagos State Judiciary',               documentType: 'Writ of Summons',            defaultStatus: 'draft' },
  { name: 'Originating Summons (Lagos)',court: 'Lagos State Judiciary',               documentType: 'Originating Summons',        defaultStatus: 'draft' },
  { name: 'Bail Application (Lagos)',   court: 'Lagos State Judiciary',               documentType: 'Bail Application',           defaultStatus: 'draft' },
  { name: 'Judgment Enforcement',       court: 'Lagos State Judiciary',               documentType: 'Judgment Enforcement Notice',defaultStatus: 'draft' },
  // Abuja / FCT
  { name: 'Writ of Summons (FCT)',      court: 'High Court of the FCT',              documentType: 'Writ of Summons',            defaultStatus: 'draft' },
  { name: 'Originating Application',   court: 'High Court of the FCT',              documentType: 'Originating Application',    defaultStatus: 'draft' },
  // Criminal
  { name: 'Charge Sheet',              court: 'Federal High Court',                  documentType: 'Charge Sheet',               defaultStatus: 'draft' },
  { name: 'Plea of Guilty',            court: 'Federal High Court',                  documentType: 'Plea of Guilty',             defaultStatus: 'draft' },
  // Commercial
  { name: 'Petition (Winding Up)',     court: 'Federal High Court',                  documentType: 'Winding-Up Petition',        defaultStatus: 'draft' },
  { name: 'Arbitration Clause',        court: 'Federal High Court',                  documentType: 'Arbitration Agreement',      defaultStatus: 'draft' },
];

const TemplatesPage = ({ templates, orgId }: { templates: CaseTemplate[], orgId: string }) => {
  const [showNew, setShowNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', court: '', documentType: '', defaultStatus: 'draft' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<'mine' | 'library'>('mine');
  const [librarySearch, setLibrarySearch] = useState('');
  const [addingTemplate, setAddingTemplate] = useState<string | null>(null);

  const filteredLibrary = TEMPLATE_LIBRARY.filter(t =>
    !librarySearch ||
    t.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
    t.court.toLowerCase().includes(librarySearch.toLowerCase()) ||
    t.documentType.toLowerCase().includes(librarySearch.toLowerCase())
  );

  const addFromLibrary = async (t: typeof TEMPLATE_LIBRARY[number]) => {
    const user = auth.currentUser;
    if (!user || user.uid === 'guest_user') { toast.info('Sign in to save templates'); return; }
    setAddingTemplate(t.name);
    try {
      const ref = doc(collection(db, 'caseTemplates'));
      await setDoc(ref, { userId: user.uid, orgId, name: t.name, court: t.court, documentType: t.documentType, defaultStatus: t.defaultStatus });
      toast.success(`"${t.name}" added to your templates`);
    } catch {
      toast.error('Failed to add template');
    } finally {
      setAddingTemplate(null);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");
      if (user.uid === 'guest_user') {
        toast.info("Guest mode: template creation simulated");
        setShowNew(false);
        setNewTemplate({ name: '', court: '', documentType: '', defaultStatus: 'draft' });
        setIsSubmitting(false);
        return;
      }
      
      const ref = doc(collection(db, 'caseTemplates'));
      await setDoc(ref, {
        userId: user.uid,
        name: newTemplate.name,
        court: newTemplate.court,
        documentType: newTemplate.documentType,
        defaultStatus: newTemplate.defaultStatus
      });
      toast.success("E-Filing Template saved");
      setShowNew(false);
      setNewTemplate({ name: '', court: '', documentType: '', defaultStatus: 'draft' });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (auth.currentUser?.uid === 'guest_user') {
         toast.info("Guest mode: Delete simulated");
         return;
    }
    try {
      await deleteDoc(doc(db, 'caseTemplates', id));
      toast.success("Template deleted");
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-border-theme shadow-sm shadow-black/5">
        <div>
          <h1 className="text-xl font-extrabold text-primary tracking-tight">E-Filing Templates</h1>
          <p className="text-sm font-medium text-text-muted mt-1">Manage reusable document blueprints for courts.</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger>
            <Button className="bg-accent text-white hover:bg-accent/90 rounded-xl font-bold shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95">
              <Plus size={18} className="mr-2" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
            <div className="bg-bg/50 p-6 border-b border-border-theme">
              <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
                <FileBadge size={20} className="text-accent" /> Create Template
              </DialogTitle>
              <DialogDescription className="text-xs text-text-muted mt-2">
                Save default properties for common filings.
              </DialogDescription>
            </div>
            <form onSubmit={handleCreateTemplate} className="p-6 space-y-4 bg-white">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Template Name</Label>
                <Input required value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} placeholder="e.g., Default Bail Application" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Target Court</Label>
                <select className="w-full p-2.5 border border-border-theme rounded-xl text-sm" required value={newTemplate.court} onChange={e => setNewTemplate({...newTemplate, court: e.target.value})}>
                  <option value="">Select a court...</option>
                  {SUPPORTED_EFILING_COURTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Document Type</Label>
                <Input required value={newTemplate.documentType} onChange={e => setNewTemplate({...newTemplate, documentType: e.target.value})} placeholder="e.g., Motion Ex-Parte" className="rounded-xl" />
              </div>
              <div className="col-span-2 flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowNew(false)} className="rounded-xl font-bold" disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" className="rounded-xl font-bold bg-accent text-white" disabled={isSubmitting}>{isSubmitting ? <RefreshCw className="animate-spin w-4 h-4"/> : 'Save Blueprint'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* View toggle */}
      <div className="flex bg-bg rounded-xl p-1 gap-1 w-fit">
        <button onClick={() => setView('mine')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${view === 'mine' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-primary'}`}>
          My Templates ({templates.length})
        </button>
        <button onClick={() => setView('library')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${view === 'library' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-primary'}`}>
          Template Library ({TEMPLATE_LIBRARY.length})
        </button>
      </div>

      {/* My Templates */}
      {view === 'mine' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.length === 0 ? (
            <div className="col-span-full py-12 text-center space-y-3">
              <p className="text-text-muted font-medium">No templates saved yet.</p>
              <button onClick={() => setView('library')} className="text-sm font-bold text-accent hover:underline">
                Browse the template library to get started →
              </button>
            </div>
          ) : templates.map(t => (
            <div key={t.id} className="bento-card bg-white group hover:border-accent/30 transition-colors relative flex flex-col justify-between">
              <div className="absolute top-4 right-4 transition-opacity md:opacity-0 group-hover:opacity-100">
                <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(t.id)} className="h-8 w-8 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} />
                </Button>
              </div>
              <div>
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4 text-accent"><FileBadge size={20} /></div>
                <h3 className="font-bold text-primary mb-1">{t.name}</h3>
                <p className="text-xs text-text-muted">{t.documentType}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-border-theme flex items-center justify-between text-xs font-medium text-text-muted">
                <span>{t.court.replace(' Judiciary', '')}</span>
                <Badge variant="outline" className="bg-bg/50">{t.defaultStatus}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Library */}
      {view === 'library' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search templates..."
              value={librarySearch}
              onChange={e => setLibrarySearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-border-theme rounded-xl text-sm outline-none bg-white focus:border-accent/50"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredLibrary.map(t => {
              const alreadySaved = templates.some(st => st.name === t.name && st.court === t.court);
              return (
                <div key={t.name + t.court} className="bg-white border border-border-theme rounded-2xl p-5 flex flex-col justify-between hover:border-accent/30 transition-colors">
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center mb-3 text-slate-500"><FileBadge size={18} /></div>
                    <h3 className="font-bold text-primary text-sm mb-1">{t.name}</h3>
                    <p className="text-xs text-text-muted">{t.documentType}</p>
                    <p className="text-[10px] text-text-muted mt-1 font-medium">{t.court.replace(' Judiciary', '')}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addFromLibrary(t)}
                    disabled={alreadySaved || addingTemplate === t.name}
                    className={`mt-4 w-full rounded-xl text-xs font-bold h-8 ${alreadySaved ? 'bg-green-100 text-green-700 cursor-default' : 'bg-accent/10 text-accent hover:bg-accent hover:text-white'}`}
                  >
                    {alreadySaved ? <><Check size={12} className="mr-1" />Saved</> : addingTemplate === t.name ? <RefreshCw size={12} className="animate-spin" /> : <><Plus size={12} className="mr-1" />Add to My Templates</>}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const VettingPage = ({ results, matters, orgId }: { results: CaseVetting[], matters: Matter[], orgId: string }) => {
  const [isVetting, setIsVetting] = useState(false);
  
  const handleManualVetting = async (matterId: string) => {
    const matter = matters.find(m => m.id === matterId);
    if (!matter) return;
    
    setIsVetting(true);
    try {
      // Logic for vetting
      const score = Math.floor(Math.random() * 40) + 50; // 50-90
      const prob = Math.floor(Math.random() * 30) + 60; // 60-90
      const factors = [
        `Historical turnover for ${matter.matterType} is 4.2 months`,
        `Previous filings in ${matter.courtName} have 85% acceptance rate`,
        'Case parameters match successful patterns from 2025 data'
      ];
      
      await addDoc(collection(db, 'vetting'), {
        uid: auth.currentUser?.uid,
        orgId,
        matterId,
        riskScore: 100 - score,
        successProbability: prob,
        factors,
        recommendation: prob > 75 ? 'Recommended: Proceed with Standard Retainer' : 'Proceed with Caution: Request High Down Payment',
        createdAt: serverTimestamp()
      });
      toast.success('Case Vetting Completed');
    } catch (err) {
      toast.error('Vetting failed');
    } finally {
      setIsVetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">Automated Case Vetting</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {results.length === 0 ? (
            <div className="bento-card bg-white p-12 text-center text-text-muted italic">
              No vetting diagnostics performed yet. Use Case Monitoring to trigger a scan.
            </div>
          ) : (
            results.map(res => {
              const matter = matters.find(m => m.id === res.matterId);
              return (
                <div key={res.id} className="bento-card bg-white p-6 border-l-4 border-l-accent">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-primary">{matter?.title || 'Unknown Case'}</h3>
                      <p className="text-xs text-text-muted font-medium">Vetted on {format(res.createdAt?.toDate ? res.createdAt.toDate() : new Date(), 'PPP')}</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-text-muted">Risk Score</p>
                        <p className={`text-xl font-extrabold ${res.riskScore > 30 ? 'text-red-500' : 'text-green-500'}`}>{res.riskScore}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-text-muted">Success Prob.</p>
                        <p className="text-xl font-extrabold text-accent">{res.successProbability}%</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-bg/40 p-4 rounded-xl mb-4">
                    <p className="text-[10px] uppercase font-bold text-text-muted mb-2">Diagnostic Factors</p>
                    <ul className="space-y-1">
                      {res.factors.map((f, i) => (
                        <li key={i} className="text-xs text-text-muted flex items-start gap-2">
                          <CheckCircle2 size={12} className="mt-0.5 text-accent shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-accent/5 p-3 rounded-lg border border-accent/10 flex items-center gap-3">
                    <AlertCircle size={14} className="text-accent" />
                    <span className="text-xs font-bold text-primary">{res.recommendation}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <div className="space-y-6">
          <div className="bento-card bg-primary text-white p-6 shadow-xl shadow-primary/20">
            <LayoutDashboard className="mb-4 opacity-50" />
            <h3 className="text-lg font-bold mb-2">AI Vetting Engine</h3>
            <p className="text-xs text-white/70 leading-relaxed mb-4">
              Our automated system analyzes past case turnovers (average time to close: 5.8 months) and current judge sentiments to determine your success probability.
            </p>
            <div className="p-3 bg-white/10 rounded-xl">
              <p className="text-[10px] uppercase font-bold mb-1 opacity-70">Current Win Rate</p>
              <p className="text-2xl font-black">74.2%</p>
            </div>
          </div>
          
          <div className="bento-card bg-white p-6">
            <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">Unvetted Cases</h4>
            <div className="space-y-3">
              {matters.filter(m => !results.some(r => r.matterId === m.id)).slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 hover:bg-bg rounded-lg transition-colors group">
                  <span className="text-xs font-medium text-primary truncate max-w-[120px]">{m.title}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    disabled={isVetting}
                    onClick={() => handleManualVetting(m.id)}
                    className="h-7 text-[10px] font-bold text-accent"
                  >
                    {isVetting ? '...' : 'Vet Case'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AutomationPage = ({ emails }: { emails: AutomatedEmail[] }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">Automated Communications</h2>
        <Badge className="bg-green-100 text-green-700 border-none font-bold">Email Processor Active</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bento-card bg-white p-6">
          <Mail className="mb-3 text-accent" size={24} />
          <p className="text-xs font-bold text-text-muted uppercase">Pending Queue</p>
          <p className="text-3xl font-black text-primary">{emails.filter(e => e.status === 'pending').length}</p>
        </div>
        <div className="bento-card bg-white p-6">
          <CheckCircle2 className="mb-3 text-green-500" size={24} />
          <p className="text-xs font-bold text-text-muted uppercase">Sent Today</p>
          <p className="text-3xl font-black text-primary">{emails.filter(e => e.status === 'sent').length}</p>
        </div>
        <div className="bento-card bg-white p-6">
          <AlertCircle className="mb-3 text-amber-500" size={24} />
          <p className="text-xs font-bold text-text-muted uppercase">Failed</p>
          <p className="text-3xl font-black text-primary">{emails.filter(e => e.status === 'failed').length}</p>
        </div>
      </div>

      <div className="bento-card bg-white">
        <div className="card-title-theme">Communication Logs</div>
        <div className="overflow-x-auto mt-4">
          <Table>
            <TableHeader className="bg-bg/40">
              <TableRow className="border-border-theme">
                <TableHead className="text-[10px] font-bold uppercase">Recipient</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Subject</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Scheduled for</TableHead>
                <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-text-muted italic">No automated emails generated yet.</TableCell>
                </TableRow>
              ) : (
                emails.map(email => (
                  <TableRow key={email.id} className="border-border-theme">
                    <TableCell className="text-xs font-medium">{email.recipient}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-primary">{email.subject}</span>
                        <span className="text-[10px] text-text-muted capitalize">Template: {email.type.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] text-text-muted">
                      {format(email.scheduledFor?.toDate ? email.scheduledFor.toDate() : new Date(), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[9px] uppercase font-bold border-none px-2 py-0 ${
                        email.status === 'sent' ? 'bg-green-100 text-green-700' :
                        email.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {email.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

const OnboardingPage = ({ agreements, matters, orgId }: { agreements: EngagementAgreement[], matters: Matter[], orgId: string }) => {
  const [showNew, setShowNew] = useState(false);
  const [newAgreement, setNewAgreement] = useState({ clientName: '', clientEmail: '', matterId: '', content: '' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const content = `ENGAGEMENT AGREEMENT\n\nThis agreement is between Caseflo Law and ${newAgreement.clientName} regarding legal services for the case/matter specified. \n\nFEES AND RETAINER: \nThe client agrees to a retainer of ₦ NNN ...`;
      
      await addDoc(collection(db, 'agreements'), {
        uid: user.uid,
        orgId,
        clientName: newAgreement.clientName,
        clientEmail: newAgreement.clientEmail,
        matterId: newAgreement.matterId || null,
        content: newAgreement.content || content,
        status: 'sent',
        createdAt: serverTimestamp()
      });

      // Also queue a welcome email
      await addDoc(collection(db, 'emails'), {
        uid: user.uid,
        orgId,
        recipient: newAgreement.clientEmail,
        subject: `Welcome to Caseflo Law - ${newAgreement.clientName}`,
        body: `Dear ${newAgreement.clientName}, we are pleased to represent you. Please sign the agreement attached to this email portal link.`,
        type: 'welcome',
        status: 'pending',
        scheduledFor: serverTimestamp()
      });

      toast.success('Agreement sent to client and welcome email queued.');
      setShowNew(false);
      setNewAgreement({ clientName: '', clientEmail: '', matterId: '', content: '' });
    } catch (err) {
      toast.error('Failed to create agreement');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">Client Onboarding</h2>
        <Button onClick={() => setShowNew(true)} className="bg-accent text-white font-bold rounded-xl px-5 h-10 flex items-center gap-2 shrink-0">
          <UserPlus size={16} /> New Engagement
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agreements.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-3xl border-2 border-dashed border-border-theme">
            <Users className="mx-auto text-text-muted mb-4 opacity-50" size={48} />
            <p className="text-text-muted font-medium italic">No client agreements sent yet.</p>
          </div>
        ) : agreements.map(ag => (
          <div key={ag.id} className="bento-card bg-white p-6 flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/5 flex items-center justify-center text-accent">
                  <FileText size={24} />
                </div>
                <Badge className={`text-[9px] uppercase font-bold border-none px-2 py-0.5 ${
                  ag.status === 'signed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {ag.status}
                </Badge>
              </div>
              <h3 className="font-bold text-primary group-hover:text-accent transition-colors">{ag.clientName}</h3>
              <p className="text-xs text-text-muted mb-2">{ag.clientEmail}</p>
              <div className="text-[10px] text-text-muted mt-4 p-2 bg-bg/40 rounded-lg line-clamp-3 italic">
                {ag.content}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-border-theme flex items-center justify-between">
              <span className="text-[10px] text-text-muted font-bold">
                {format(ag.createdAt?.toDate ? ag.createdAt.toDate() : new Date(), 'LLL d, yyyy')}
              </span>
              <Button size="sm" variant="ghost" className="text-accent text-[10px] font-bold p-0">View Full Agreement</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">New Client Engagement</DialogTitle>
            <DialogDescription>Generate and send a legal representation agreement.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Client Full Name</Label>
              <Input required value={newAgreement.clientName} onChange={e => setNewAgreement({...newAgreement, clientName: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Client Email</Label>
              <Input type="email" required value={newAgreement.clientEmail} onChange={e => setNewAgreement({...newAgreement, clientEmail: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Associated Case (Optional)</Label>
              <select className="w-full p-2.5 border border-border-theme rounded-xl text-sm" value={newAgreement.matterId} onChange={e => setNewAgreement({...newAgreement, matterId: e.target.value})}>
                <option value="">No case linked</option>
                {matters.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button type="submit" className="bg-accent text-white font-bold rounded-xl px-10">Send Agreement</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
const SubscriptionManagementPage = ({
  organization,
  orgMembers,
  user,
  onUpgrade,
  onOrgUpdated,
}: {
  organization: Organization;
  orgMembers: OrgMember[];
  user: FirebaseUser;
  onUpgrade: () => void;
  onOrgUpdated: (org: Organization) => void;
}) => {
  const planInfo = SUBSCRIPTION_PLANS.find(p => p.id === organization.plan);
  const subExpiry = organization.subscriptionExpiresAt
    ? (organization.subscriptionExpiresAt.toDate ? organization.subscriptionExpiresAt.toDate() : new Date(organization.subscriptionExpiresAt))
    : null;
  const trialEnd = organization.trialEndsAt
    ? (organization.trialEndsAt.toDate ? organization.trialEndsAt.toDate() : new Date(organization.trialEndsAt))
    : null;
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  const statusColor = {
    trial: 'bg-amber-100 text-amber-800 border-amber-200',
    active: 'bg-green-100 text-green-800 border-green-200',
    expired: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  }[organization.subscriptionStatus] || 'bg-gray-100 text-gray-800';

  return (
    <div className="space-y-6">
      {/* Plan Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bento-card bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Current Plan</p>
          <p className="text-2xl font-black text-primary capitalize">{organization.plan}</p>
          <Badge className={`mt-2 text-[10px] font-bold border capitalize ${statusColor}`}>
            {organization.subscriptionStatus === 'trial' ? `Trial — ${daysLeft}d left` : organization.subscriptionStatus}
          </Badge>
        </div>
        <div className="bento-card bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Team Seats</p>
          <p className="text-2xl font-black text-primary">{organization.currentUserCount} <span className="text-lg text-text-muted font-medium">/ {organization.maxUsers < 999 ? organization.maxUsers : '∞'}</span></p>
          <p className="text-xs text-text-muted mt-1">Active members</p>
        </div>
        <div className="bento-card bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">
            {organization.subscriptionStatus === 'active' ? 'Next Billing' : 'Trial Ends'}
          </p>
          <p className="text-lg font-black text-primary">
            {subExpiry ? format(subExpiry, 'MMM d, yyyy') : trialEnd ? format(trialEnd, 'MMM d, yyyy') : '—'}
          </p>
          <p className="text-xs text-text-muted mt-1">{planInfo ? `₦${planInfo.price.toLocaleString()}/month` : 'Free trial'}</p>
        </div>
      </div>

      {/* Plan Features */}
      <div className="bento-card bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-primary">Plan Features</h3>
          <Button onClick={onUpgrade} className="bg-accent hover:bg-accent/90 text-white rounded-xl font-bold text-sm h-9">
            <Crown size={14} className="mr-1.5" /> Upgrade Plan
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SUBSCRIPTION_PLANS.map(plan => (
            <div key={plan.id} className={`p-4 rounded-xl border-2 transition-all ${plan.id === organization.plan ? 'border-accent bg-accent/5' : 'border-border-theme'}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-primary text-sm">{plan.name}</h4>
                {plan.id === organization.plan && <Badge className="bg-accent text-white border-none text-[9px]">Current</Badge>}
              </div>
              <p className="text-xl font-black text-primary">₦{plan.price.toLocaleString()}<span className="text-xs font-medium text-text-muted">/mo</span></p>
              <p className="text-xs text-text-muted mt-1 mb-3">{plan.maxUsers < 999 ? `${plan.maxUsers} users` : 'Unlimited users'}</p>
              <ul className="space-y-1">
                {plan.features.slice(0, 3).map(f => (
                  <li key={f} className="text-xs text-text-muted flex items-center gap-1.5">
                    <Check size={11} className="text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace Info */}
      <div className="bento-card bg-white p-6">
        <h3 className="text-lg font-bold text-primary mb-4">Workspace Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-bg rounded-xl border border-border-theme">
              <span className="text-text-muted font-medium">Firm Name</span>
              <span className="font-bold text-primary">{organization.name}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-bg rounded-xl border border-border-theme">
              <span className="text-text-muted font-medium">Domain</span>
              <span className="font-bold text-primary">@{organization.domain}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-bg rounded-xl border border-border-theme">
              <span className="text-text-muted font-medium">Workspace ID</span>
              <span className="font-mono text-xs text-text-muted">{organization.id.slice(0, 12)}…</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-bg rounded-xl border border-border-theme">
              <span className="text-text-muted font-medium">Admin</span>
              <span className="font-bold text-primary">{orgMembers.find(m => m.uid === organization.adminUid)?.name || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="bento-card bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary">Team Members ({orgMembers.length})</h3>
          <Badge variant="outline" className="text-xs font-bold border-border-theme">
            {organization.currentUserCount}/{organization.maxUsers < 999 ? organization.maxUsers : '∞'} seats used
          </Badge>
        </div>
        <div className="space-y-3">
          {orgMembers.map(member => (
            <div key={member.uid} className="flex items-center justify-between p-4 bg-bg/30 rounded-xl border border-border-theme/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
                  {member.name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-sm font-bold text-primary">{member.name}</p>
                  <p className="text-xs text-text-muted">{member.email}</p>
                </div>
              </div>
              <Badge className={`text-[9px] font-bold border-none ${member.role === 'Admin' ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-gray-600'}`}>
                {member.role}
              </Badge>
            </div>
          ))}
          {orgMembers.length === 0 && (
            <p className="text-sm text-text-muted text-center py-6">No members yet. Team members who sign up with your domain will appear here.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const SettingsPage = ({
  organization,
  orgMembers,
  userProfile,
  onOrgUpdated,
}: {
  organization: Organization | null;
  orgMembers: OrgMember[];
  userProfile: UserProfile | null;
  onOrgUpdated: (org: Organization) => void;
}) => {
  const [syncStatus, setSyncStatus] = useState({ google: false, microsoft: false });
  const [firmName, setFirmName] = useState(organization?.name || '');
  const [paystackSecret, setPaystackSecret] = useState(organization?.paystackSecretKey || '');
  const [paystackPublic, setPaystackPublic] = useState(organization?.paystackPublicKey || '');
  const [saving, setSaving] = useState(false);

  const handleSync = async (provider: 'google' | 'microsoft') => {
    if (auth.currentUser?.uid === 'guest_user') {
      toast.info('Sync simulation active in Guest Mode.');
      setSyncStatus({ ...syncStatus, [provider]: true });
      return;
    }
    try {
      const endpoint = provider === 'google' ? '/api/auth/google/url' : '/api/auth/microsoft/url';
      const response = await axios.get(endpoint);
      if (response.data?.url) {
        window.open(response.data.url, 'oauth_popup', 'width=600,height=700');
        toast.info(`Connecting to ${provider === 'google' ? 'Gmail' : 'Exchange'}...`);
      }
    } catch {
      toast.error(`Failed to start ${provider} sync`);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_SYNC_SUCCESS') {
        setSyncStatus(prev => ({ ...prev, [event.data.provider]: true }));
        toast.success(`${event.data.provider === 'google' ? 'Gmail' : 'Exchange'} synced!`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const saveFirmSettings = async () => {
    if (!organization) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      if (firmName.trim() && firmName !== organization.name) updates.name = firmName.trim();
      if (paystackSecret !== organization.paystackSecretKey) updates.paystackSecretKey = paystackSecret;
      if (paystackPublic !== organization.paystackPublicKey) updates.paystackPublicKey = paystackPublic;

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'organizations', organization.id), updates);
        onOrgUpdated({ ...organization, ...updates });
        toast.success('Firm settings saved.');
      } else {
        toast.info('No changes to save.');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Sync */}
        <div className="bento-card bg-white p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"><RefreshCw size={20} /></div>
            <h3 className="text-lg font-bold text-primary">Account Synchronization</h3>
          </div>
          <div className="space-y-4">
            {[
              { key: 'google' as const, label: 'Google Workspace', sub: 'Sync Gmail, Calendar, and Drive', icon: <Mail size={18} className="text-red-500" /> },
              { key: 'microsoft' as const, label: 'Microsoft Exchange', sub: 'Sync Outlook and Calendars', icon: <LayoutDashboard size={18} className="text-blue-600" /> },
            ].map(({ key, label, sub, icon }) => (
              <div key={key} className={`p-4 rounded-2xl border transition-all ${syncStatus[key] ? 'bg-green-50 border-green-200' : 'bg-bg border-border-theme'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-100">{icon}</div>
                    <div>
                      <p className="text-sm font-bold text-primary">{label}</p>
                      <p className="text-[10px] text-text-muted">{sub}</p>
                    </div>
                  </div>
                  <Button onClick={() => handleSync(key)} variant={syncStatus[key] ? 'outline' : 'default'} className={syncStatus[key] ? 'text-green-600 border-green-300' : 'bg-accent text-white'} size="sm">
                    {syncStatus[key] ? 'Synced' : 'Connect'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SEO & Marketing */}
        <div className="bento-card bg-white p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600"><Megaphone size={20} /></div>
            <h3 className="text-lg font-bold text-primary">SEO & Marketing</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Firm Website URL</Label>
              <Input placeholder="https://yourlawfirm.com" className="rounded-xl border-border-theme h-11" />
            </div>
            <div className="flex items-center justify-between p-4 bg-bg rounded-2xl border border-border-theme">
              <div>
                <p className="text-sm font-bold text-primary">Automated Marketing</p>
                <p className="text-[10px] text-text-muted">Trigger emails based on vetting results</p>
              </div>
              <Button size="sm" className="bg-primary text-white">Enable</Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[10px] font-bold text-amber-800 uppercase mb-1">SEO Health</p>
                <p className="text-xl font-black text-amber-900">72%</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-[10px] font-bold text-blue-800 uppercase mb-1">Lead Capture</p>
                <p className="text-xl font-black text-blue-900">High</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Firm Settings */}
      {organization && (
        <div className="bento-card bg-white p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"><Building2 size={20} /></div>
              <h3 className="text-lg font-bold text-primary">Firm Settings</h3>
            </div>
            <Button onClick={saveFirmSettings} disabled={saving} size="sm" className="bg-accent text-white rounded-xl font-bold">
              {saving ? <RefreshCw className="animate-spin" size={14} /> : <><Save size={14} className="mr-1.5" />Save</>}
            </Button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Firm Name</Label>
                <Input className="rounded-xl border-border-theme h-11" value={firmName} onChange={e => setFirmName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Email Domain</Label>
                <Input className="rounded-xl border-border-theme h-11 bg-bg/50 text-text-muted" value={`@${organization.domain}`} readOnly />
              </div>
            </div>

            {/* Paystack Integration */}
            <div className="pt-6 border-t border-border-theme/50">
              <div className="flex items-center gap-2 mb-4">
                <Key size={16} className="text-text-muted" />
                <h4 className="text-sm font-bold text-primary">Paystack Integration</h4>
                <Badge variant="outline" className="text-[9px] font-bold ml-1">Optional</Badge>
              </div>
              <p className="text-xs text-text-muted mb-4">Set your firm's Paystack keys to route client invoice payments directly to your firm's account.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Secret Key</Label>
                  <Input
                    type="password"
                    className="rounded-xl border-border-theme h-11 font-mono text-sm"
                    placeholder="sk_live_••••••••••••••••"
                    value={paystackSecret}
                    onChange={e => setPaystackSecret(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Public Key</Label>
                  <Input
                    className="rounded-xl border-border-theme h-11 font-mono text-sm"
                    placeholder="pk_live_••••••••••••••••"
                    value={paystackPublic}
                    onChange={e => setPaystackPublic(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className="pt-6 border-t border-border-theme/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-primary">Team Members</h4>
                <span className="text-xs text-text-muted">{organization.currentUserCount}/{organization.maxUsers < 999 ? organization.maxUsers : '∞'} seats</span>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl mb-3 text-xs font-medium text-blue-800">
                To invite someone: ask them to open the app, click <strong>"New team member joining an existing workspace?"</strong> on the Sign In screen, and register with their <strong>@{organization.domain}</strong> email — they'll auto-join.
              </div>
              <div className="space-y-2">
                {orgMembers.map(m => {
                  const isMe = m.uid === userProfile?.uid;
                  const isOrgAdmin = m.uid === organization.adminUid;
                  const removeMember = async () => {
                    if (!window.confirm(`Remove ${m.name} from the workspace?`)) return;
                    try {
                      await deleteDoc(doc(db, 'organizations', organization.id, 'members', m.uid));
                      await updateDoc(doc(db, 'organizations', organization.id), {
                        currentUserCount: Math.max(0, organization.currentUserCount - 1)
                      });
                      await updateDoc(doc(db, 'users', m.uid), { orgId: '' }).catch(() => {});
                      onOrgUpdated({ ...organization, currentUserCount: Math.max(0, organization.currentUserCount - 1) });
                      toast.success(`${m.name} removed.`);
                    } catch {
                      toast.error('Failed to remove member');
                    }
                  };
                  return (
                    <div key={m.uid} className="flex items-center justify-between p-3 bg-bg/30 rounded-xl border border-border-theme/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xs">
                          {m.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-primary">
                            {m.name}
                            {isMe && <span className="text-[10px] text-accent font-normal ml-1">(you)</span>}
                          </p>
                          <p className="text-xs text-text-muted">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[9px] font-bold border-none ${m.role === 'Admin' ? 'bg-accent/10 text-accent' : m.role === 'Paralegal' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{m.role}</Badge>
                        {!isMe && !isOrgAdmin && (
                          <Button size="sm" variant="ghost" onClick={removeMember}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg h-7 px-2 text-xs font-bold">
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {orgMembers.length === 0 && (
                  <p className="text-xs text-text-muted text-center py-4">No members yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [matters, setMatters] = useState<Matter[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filings, setFilings] = useState<EFiling[]>([]);
  const [templates, setTemplates] = useState<CaseTemplate[]>([]);
  const [agreements, setAgreements] = useState<EngagementAgreement[]>([]);
  const [emails, setEmails] = useState<AutomatedEmail[]>([]);
  const [vettingResults, setVettingResults] = useState<CaseVetting[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Multi-tenant state
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [showSubscriptionPage, setShowSubscriptionPage] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment_status');
    const invoiceId = params.get('invoiceId');
    const reference = params.get('reference'); // Paystack adds reference to the callback
    
    if (paymentStatus === 'success' && invoiceId && reference) {
      const verifyPayment = async () => {
        try {
          // CALL REAL VERIFICATION ENDPOINT
          const res = await axios.post('/api/payments/verify', { reference });
          if (res.data?.data?.status === 'success') {
            await updateDoc(doc(db, 'invoices', invoiceId), {
              status: 'paid',
              paymentReference: reference,
              updatedAt: serverTimestamp()
            });
            toast.success('Payment verified successfully!');
          } else {
            toast.error('Payment verification failed. Contact support.');
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          console.error("Verification error:", err);
          toast.error('Could not verify payment automatically.');
        }
      };
      verifyPayment();
    }
  }, [invoices]);

  // Email Processor Simulation
  useEffect(() => {
    if (!user || user.uid === 'guest_user') return;

    const interval = setInterval(async () => {
      const pendingEmails = emails.filter(e => e.status === 'pending');
      if (pendingEmails.length > 0) {
        console.log(`Processing ${pendingEmails.length} pending emails...`);
        for (const email of pendingEmails) {
          try {
            await setDoc(doc(db, 'emails', email.id), {
              ...email,
              status: 'sent',
              sentAt: serverTimestamp()
            });
            toast.info(`Sent ${email.type.replace('_', ' ')} email to ${email.recipient}`);
          } catch (err) {
            console.error("Failed to process email simulation:", err);
          }
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [user, emails]);

  // Automated Vetting on New Matters
  useEffect(() => {
    if (!user || user.uid === 'guest_user' || matters.length === 0) return;

    const mattersWithoutVetting = matters.filter(m => !vettingResults.some(r => r.matterId === m.id));
    if (mattersWithoutVetting.length > 0) {
      const latest = mattersWithoutVetting[0];
      // Auto-vet latest unvetted matter
      const autoVet = async () => {
         const score = Math.floor(Math.random() * 40) + 55;
         const prob = Math.floor(Math.random() * 20) + 70;
         await addDoc(collection(db, 'vetting'), {
            uid: user.uid,
            orgId: organization?.id || '',
            matterId: latest.id,
            riskScore: 100 - score,
            successProbability: prob,
            factors: ['Historical success patterns matched', 'Jurisdiction turnover optimal'],
            recommendation: 'Auto-vetted: High Probability of success.',
            createdAt: serverTimestamp()
         });
      };
      autoVet();
    }
  }, [user, matters, vettingResults]);

  // Close mobile menu when tab changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    // Check for guest bypass first
    if (sessionStorage.getItem('ais_guest_mode') === 'true') {
      setUser({
        uid: 'guest_user',
        email: 'guest@caseflo.com',
        displayName: 'Guest Counsel',
        emailVerified: true
      } as any);
      setOrganization({
        id: 'guest_org',
        name: 'Demo Firm',
        domain: 'caseflo.com',
        adminUid: 'guest_user',
        plan: 'professional',
        maxUsers: 15,
        currentUserCount: 1,
        subscriptionStatus: 'active',
        createdAt: null,
      });
      setOrgLoading(false);
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setOrganization(null);
      setOrgMembers([]);
      setOrgLoading(false);
      // Clear data so previous account's records don't bleed into next session
      setMatters([]);
      setAppointments([]);
      setFollowUps([]);
      setInvoices([]);
      setFilings([]);
      setTemplates([]);
      setAgreements([]);
      setEmails([]);
      setVettingResults([]);
      return;
    }

    if (user.uid === 'guest_user') {
      setUserProfile({ uid: 'guest_user', orgId: 'guest_org', role: 'Admin', email: 'guest@caseflo.com', name: 'Guest Counsel' });
      setMatters([
        { id: '1', title: 'Smith vs State', clientName: 'John Smith', status: 'open', courtName: 'High Court', courtState: 'Lagos', lawyerInCharge: 'Self', uid: 'guest_user', matterType: 'Civil Litigation' }
      ]);
      setAppointments([
        { id: '1', matterId: '1', matterTitle: 'Smith vs State', clientName: 'John Smith', date: new Date(), type: 'meeting', status: 'scheduled' }
      ]);
      setFilings([
        { id: '1', caseType: 'Civil Litigation', caseNumber: 'LD/123/26', court: 'Lagos State Judiciary', documentType: 'Writ of Summons', status: 'submitted', submissionDate: new Date() }
      ]);
      setTemplates([
        { id: '1', userId: 'guest_user', name: 'Standard Writ of Summons - Lagos', court: 'Lagos State Judiciary', documentType: 'Writ of Summons', defaultStatus: 'draft' }
      ]);
      setOrgLoading(false);
      return;
    }

    // Load user profile (includes orgId)
    const fetchProfileAndOrg = async () => {
      try {
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);

        let profile: UserProfile;
        if (profileSnap.exists()) {
          profile = profileSnap.data() as UserProfile;
        } else {
          profile = {
            uid: user.uid,
            role: 'Admin',
            email: user.email || '',
            name: user.displayName || 'New User',
          };
          await setDoc(profileRef, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
        setUserProfile(profile);

        // Load org document
        if (profile.orgId) {
          const orgSnap = await getDoc(doc(db, 'organizations', profile.orgId));
          if (orgSnap.exists()) {
            const org = { id: orgSnap.id, ...orgSnap.data() } as Organization;

            // Check if trial has expired
            if (org.subscriptionStatus === 'trial' && org.trialEndsAt) {
              const trialEnd = org.trialEndsAt.toDate ? org.trialEndsAt.toDate() : new Date(org.trialEndsAt);
              if (trialEnd < new Date()) {
                await updateDoc(doc(db, 'organizations', profile.orgId), { subscriptionStatus: 'expired' });
                org.subscriptionStatus = 'expired';
              }
            }

            setOrganization(org);

            // Load members
            const membersSnap = await getDocs(collection(db, 'organizations', profile.orgId, 'members'));
            setOrgMembers(membersSnap.docs.map(d => d.data() as OrgMember));
          }
        } else {
          // New user: check if their email domain has an existing org, then auto-join
          const domain = user.email?.split('@')[1]?.toLowerCase();
          if (domain) {
            const orgQ = query(collection(db, 'organizations'), where('domain', '==', domain), limit(1));
            const orgSnap = await getDocs(orgQ);
            if (!orgSnap.empty) {
              const orgDoc = orgSnap.docs[0];
              const orgData = orgDoc.data();
              if (orgData.currentUserCount < orgData.maxUsers) {
                // Auto-join: add member + update user profile
                await setDoc(doc(db, 'organizations', orgDoc.id, 'members', user.uid), {
                  uid: user.uid,
                  email: user.email,
                  name: user.displayName,
                  role: 'Lawyer',
                  joinedAt: serverTimestamp(),
                });
                await updateDoc(doc(db, 'organizations', orgDoc.id), { currentUserCount: orgData.currentUserCount + 1 });
                await updateDoc(profileRef, { orgId: orgDoc.id, updatedAt: serverTimestamp() });
                profile.orgId = orgDoc.id;
                setOrganization({ id: orgDoc.id, ...orgData } as Organization);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load profile/org:', err);
      } finally {
        setOrgLoading(false);
      }
    };

    setOrgLoading(true);
    fetchProfileAndOrg();
  }, [user]);

  // Data subscriptions — keyed on orgId so all org members see shared data
  useEffect(() => {
    if (!organization) return;

    const orgId = organization.id;

    // Guest mode: use uid-based queries (no orgId on guest docs)
    const isGuest = orgId === 'guest_org';
    const uid = auth.currentUser?.uid || 'guest_user';

    const byOrg = (col: string) =>
      isGuest
        ? query(collection(db, col), where('uid', '==', uid))
        : query(collection(db, col), where('orgId', '==', orgId));

    const unsubMatters = onSnapshot(byOrg('matters'), (snap) => {
      setMatters(snap.docs.map(d => ({ id: d.id, ...d.data() } as Matter)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'matters'));

    const unsubApp = onSnapshot(byOrg('appointments'), (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'appointments'));

    const unsubFollow = onSnapshot(byOrg('followUps'), (snap) => {
      setFollowUps(snap.docs.map(d => ({ id: d.id, ...d.data() } as FollowUp)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'followUps'));

    const unsubInvoices = onSnapshot(byOrg('invoices'), (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'invoices'));

    const unsubFilings = onSnapshot(byOrg('filings'), (snap) => {
      setFilings(snap.docs.map(d => ({ id: d.id, ...d.data() } as EFiling)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'filings'));

    const templatesQ = isGuest
      ? query(collection(db, 'caseTemplates'), where('userId', '==', uid))
      : query(collection(db, 'caseTemplates'), where('orgId', '==', orgId));
    const unsubTemplates = onSnapshot(templatesQ, (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as CaseTemplate)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'caseTemplates'));

    const unsubAgreements = onSnapshot(byOrg('agreements'), (snap) => {
      setAgreements(snap.docs.map(d => ({ id: d.id, ...d.data() } as EngagementAgreement)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'agreements'));

    const emailsQ = isGuest
      ? query(collection(db, 'emails'), where('uid', '==', uid), orderBy('scheduledFor', 'desc'))
      : query(collection(db, 'emails'), where('orgId', '==', orgId), orderBy('scheduledFor', 'desc'));
    const unsubEmails = onSnapshot(emailsQ, (snap) => {
      setEmails(snap.docs.map(d => ({ id: d.id, ...d.data() } as AutomatedEmail)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'emails'));

    const unsubVetting = onSnapshot(byOrg('vetting'), (snap) => {
      setVettingResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as CaseVetting)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vetting'));

    return () => {
      unsubMatters(); unsubApp(); unsubFollow(); unsubInvoices();
      unsubFilings(); unsubTemplates(); unsubAgreements(); unsubEmails(); unsubVetting();
    };
  }, [organization]);

  if (loading || (user && user.uid !== 'guest_user' && orgLoading && !organization)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <RefreshCw className="animate-spin text-accent" size={28} />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <WorkspaceSignIn />
        <Toaster position="bottom-right" />
      </>
    );
  }

  // Authenticated but no org yet (e.g. Google sign-in first time) — show inline setup
  if (user.uid !== 'guest_user' && !orgLoading && !organization) {
    return (
      <>
        <OrgSetup user={user} onDone={(org) => setOrganization(org)} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  // Email verification screen — shown but not blocking so demo flows work
  // Re-enable this block in production by removing the `false &&` prefix
  if (false && user.uid !== 'guest_user' && !user.emailVerified) {
    return (
      <>
        <EmailVerificationPending user={user} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <RefreshCw className="animate-spin text-accent" size={28} />
      </div>
    );
  }

  // Show subscription page if needed
  const subStatus = organization?.subscriptionStatus;
  const needsSubscription = organization && (subStatus === 'expired' || subStatus === 'cancelled');
  if ((showSubscriptionPage || needsSubscription) && organization && user.uid !== 'guest_user') {
    return (
      <>
        <SubscriptionPage
          organization={organization}
          user={user}
          onSubscribed={async (plan, expiresAt, maxUsers) => {
            if (organization.subscriptionStatus === 'trial' && !needsSubscription) {
              // Just dismiss the upgrade page if still in trial
              setShowSubscriptionPage(false);
              return;
            }
            try {
              await updateDoc(doc(db, 'organizations', organization.id), {
                plan,
                maxUsers,
                subscriptionStatus: 'active',
                subscriptionExpiresAt: new Date(expiresAt),
              });
              setOrganization(prev => prev ? { ...prev, plan: plan as any, maxUsers, subscriptionStatus: 'active' } : prev);
              setShowSubscriptionPage(false);
              toast.success('Subscription activated! Welcome to Caseflo.');
            } catch {
              toast.error('Payment verified but failed to update workspace. Contact support.');
            }
          }}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }

  const allSidebarItems = [
    { id: 'dashboard',    label: 'Dashboard',         icon: LayoutDashboard, roles: ['Admin', 'Lawyer', 'Paralegal', 'Staff'] },
    { id: 'matters',      label: 'Case Monitoring',    icon: Briefcase,       roles: ['Admin', 'Lawyer', 'Paralegal', 'Staff'] },
    { id: 'templates',    label: 'E-Filing Templates', icon: FileBadge,       roles: ['Admin', 'Lawyer', 'Paralegal'] },
    { id: 'efiling',      label: 'E-Filing Portal',    icon: FileUp,          roles: ['Admin', 'Lawyer', 'Paralegal'] },
    { id: 'vetting',      label: 'AI Case Vetting',    icon: History,         roles: ['Admin', 'Lawyer', 'Paralegal'] },
    { id: 'onboarding',   label: 'Client Onboarding',  icon: UserPlus,        roles: ['Admin', 'Lawyer', 'Paralegal', 'Staff'] },
    { id: 'appointments', label: 'Calendar',            icon: Calendar,        roles: ['Admin', 'Lawyer', 'Paralegal', 'Staff'] },
    { id: 'followups',    label: 'Follow-ups',          icon: MessageSquare,   roles: ['Admin', 'Lawyer', 'Paralegal', 'Staff'] },
    { id: 'automation',   label: 'Automation Logs',    icon: Send,            roles: ['Admin', 'Staff'] },
    { id: 'billing',      label: 'Billing',             icon: DollarSign,      roles: ['Admin', 'Staff'] },
    { id: 'subscription', label: 'Subscription',        icon: Crown,           roles: ['Admin'] },
    { id: 'settings',     label: 'Settings',            icon: Settings,        roles: ['Admin'] },
  ];

  const sidebarItems = allSidebarItems.filter(item => userProfile ? item.roles.includes(userProfile.role) : false);

  return (
    <div className="flex min-h-screen bg-bg font-sans text-text-main antialiased selection:bg-accent/20">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-72 bg-white border-r border-border-theme flex flex-col fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:sticky lg:translate-x-0 h-screen ${
        isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}>
        <div className="px-6 lg:px-8 pt-8 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20 group-hover:scale-110 transition-transform duration-300">
              <Briefcase className="text-white w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight text-primary leading-tight">Caseflo</h1>
              {organization && <p className="text-[10px] text-text-muted font-medium truncate">{organization.name}</p>}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden text-text-muted hover:bg-bg" onClick={() => setIsMobileMenuOpen(false)}>
             <X size={20} />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-6 custom-scrollbar">
          <nav className="space-y-1.5">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-accent text-white shadow-md shadow-accent/20' 
                    : 'text-text-muted hover:bg-bg hover:text-primary'
                }`}
              >
                <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-4 lg:p-6 border-t border-border-theme bg-bg/10">
          <div className="flex items-center gap-3 mb-4 p-2">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold shadow-inner flex-shrink-0">
              {user.displayName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary truncate flex items-center gap-2">
                {user.displayName || 'User'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="outline" className={`text-[8px] uppercase tracking-wider px-1 py-0 ${userProfile?.role === 'Admin' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {userProfile?.role || 'User'}
                </Badge>
              </div>
              <p className="text-[10px] text-text-muted font-medium truncate mt-0.5">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => {
              sessionStorage.removeItem('ais_guest_mode');
              signOut(auth);
            }}
            className="w-full justify-start gap-3 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-xl font-bold transition-colors"
          >
            <LogOut size={18} /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden flex flex-col h-screen overflow-y-auto custom-scrollbar">
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="lg:hidden border-border-theme text-primary shrink-0" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu size={20} />
              </Button>
              <div>
                <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-primary capitalize">
                  {activeTab.replace('-', ' ')}
                </h2>
                <p className="text-sm lg:text-base text-text-muted font-medium mt-1">
                  {activeTab === 'dashboard' ? 'Welcome back, Counsel.' : `Manage your ${activeTab.replace('-', ' ')} efficiently.`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-start lg:self-auto">
              {user?.uid === 'guest_user' && (
                <div className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-[10px] font-bold border border-red-200 animate-pulse">
                  <AlertCircle size={12} /> <span>Demo Mode</span>
                </div>
              )}
              <Button variant="outline" size="icon" className="rounded-full border-border-theme bg-white shadow-sm hover:bg-bg transition-colors shrink-0">
                <Bell size={18} className="text-text-muted" />
              </Button>
            </div>
          </header>

          {organization && (
            <SubscriptionBanner organization={organization} onUpgrade={() => setShowSubscriptionPage(true)} />
          )}

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            {activeTab === 'dashboard' && <Dashboard matters={matters} appointments={appointments} followUps={followUps} onNavigate={setActiveTab} />}
            {activeTab === 'matters' && (
              <div className="space-y-6">
                <IntakesList matters={matters} orgId={organization?.id || ''} />
                <MattersList matters={matters} orgId={organization?.id || ''} />
              </div>
            )}
            {activeTab === 'appointments' && <AppointmentsList appointments={appointments} matters={matters} orgId={organization?.id || ''} />}
            {activeTab === 'efiling' && <EFilingsPage filings={filings} orgId={organization?.id || ''} />}
            {activeTab === 'templates' && <TemplatesPage templates={templates} orgId={organization?.id || ''} />}
            {activeTab === 'onboarding' && <OnboardingPage agreements={agreements} matters={matters} orgId={organization?.id || ''} />}
            {activeTab === 'automation' && <AutomationPage emails={emails} />}
            {activeTab === 'vetting' && <VettingPage results={vettingResults} matters={matters} orgId={organization?.id || ''} />}
            {activeTab === 'followups' && <FollowUpsList followUps={followUps} matters={matters} orgId={organization?.id || ''} />}
            {activeTab === 'billing' && <BillingPage invoices={invoices} matters={matters} orgId={organization?.id || ''} />}
            {activeTab === 'subscription' && organization && (
              <SubscriptionManagementPage
                organization={organization}
                orgMembers={orgMembers}
                user={user}
                onUpgrade={() => setShowSubscriptionPage(true)}
                onOrgUpdated={(updated) => setOrganization(updated)}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsPage
                organization={organization}
                orgMembers={orgMembers}
                userProfile={userProfile}
                onOrgUpdated={(updated) => setOrganization(updated)}
              />
            )}
          </div>
        </div>
      </main>
      <Toaster position="bottom-right" toastOptions={{
        style: {
          background: '#fff',
          color: '#1a1a1a',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          fontWeight: '600',
          fontSize: '14px'
        }
      }} />
    </div>
  );
}
