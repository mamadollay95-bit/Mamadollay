/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Home, 
  PlusCircle, 
  ClipboardList, 
  Calendar, 
  User, 
  MapPin, 
  Clock, 
  FileText, 
  Image as ImageIcon,
  ChevronLeft,
  Search,
  CheckCircle2,
  Trash2,
  Plus,
  Users,
  LogOut,
  Lock,
  LogIn,
  Download,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppView, DailyJob, MasterJob, Shift, UserAccount } from './types';

// Firebase Imports
import { db, auth, signInWithGoogle, logOut } from './lib/firebase';
import { 
  collection, 
  setDoc, 
  doc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  getDocs,
  where,
  limit,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { handleFirestoreError, OperationType } from './lib/firebaseUtils';

// Mock Master Jobs
const INITIAL_MASTER_JOBS: MasterJob[] = [
  // Gudang Cibitung - Shift 1A
  { id: 'gc-1a-1', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan ruangan ADM Outbound' },
  { id: 'gc-1a-2', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan meja dan computer ruang ADM Outbound' },
  { id: 'gc-1a-3', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan area Praposting' },
  { id: 'gc-1a-4', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan meja dan computer area Praposting' },
  { id: 'gc-1a-5', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan area Receiving Outbound' },
  { id: 'gc-1a-6', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan meja dan computer area Receiving' },
  { id: 'gc-1a-7', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan area Parkir motor' },
  { id: 'gc-1a-8', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan area kantin' },
  { id: 'gc-1a-9', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan ruang IT' },
  { id: 'gc-1a-10', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan meja dan komputer ruang IT' },
  { id: 'gc-1a-11', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan ruang CO Working' },
  { id: 'gc-1a-12', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan meja dan perangkat ruang CO Workinng' },
  { id: 'gc-1a-13', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan Kamar Mandi Depan' },
  { id: 'gc-1a-14', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan Kamar Mandi Tamu' },
  { id: 'gc-1a-15', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan meja dan computer ruang SCO (Abi Daud)' },
  { id: 'gc-1a-16', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan Kaca area SCO-TS-CO Working' },
  { id: 'gc-1a-17', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Pengisian Galon' },
  { id: 'gc-1a-18', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Storing Kebersihan Halaman' },
  { id: 'gc-1a-19', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Sortir karung' },
  { id: 'gc-1a-20', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan Kamar mandi PIC' },
  { id: 'gc-1a-21', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan Mushola' },
  { id: 'gc-1a-22', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan area Gudang Inbound-Gateway' },
  { id: 'gc-1a-23', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan area Halaman Gudang Inbound-Gateway' },
  { id: 'gc-1a-24', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan Sulo area Gudang Inbound-Gateway' },
  { id: 'gc-1a-25', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Lain – Lain' },
  { id: 'gc-1a-26', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1A', kegiatan: 'Kebersihan ruang SCO' },

  // Gudang Cibitung - Shift 1B
  { id: 'gc-1b-1', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan ruangan ADM Inbound' },
  { id: 'gc-1b-2', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan Meja dan computer ruangan ADM Inbound' },
  { id: 'gc-1b-3', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan Urinoir ruang ADM Inbound' },
  { id: 'gc-1b-4', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan area Cheker POD' },
  { id: 'gc-1b-5', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan area Halaman Adm Inbound-Pos Scurity' },
  { id: 'gc-1b-6', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan area Pos Scurity dan gardu' },
  { id: 'gc-1b-7', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Pengisian Galon' },
  { id: 'gc-1b-8', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Storing Kebersihan Halaman' },
  { id: 'gc-1b-9', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Sortir karung' },
  { id: 'gc-1b-10', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan Kamar mandi PIC' },
  { id: 'gc-1b-11', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan Mushola' },
  { id: 'gc-1b-12', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan area Gudang Inbound-Gateway' },
  { id: 'gc-1b-13', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan area Halaman Gudang Inbound-Gateway' },
  { id: 'gc-1b-14', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan Sulo area Gudang Inbound-Gateway' },
  { id: 'gc-1b-15', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Lain – Lain' },
  { id: 'gc-1b-16', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 1B', kegiatan: 'Kebersihan ruang SCO' },

  // Gudang Cibitung - Shift 2
  { id: 'gc-2-1', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan area Gudang Outbound' },
  { id: 'gc-2-2', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Meja dan Komputer area Gudang Outbound' },
  { id: 'gc-2-3', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan area Lorong belakang Gudang Outbound' },
  { id: 'gc-2-4', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Urinoir Gudang Outbound' },
  { id: 'gc-2-5', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Pengangkutan sampah Gudang Obd and packing kayu' },
  { id: 'gc-2-6', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Sortir karung' },
  { id: 'gc-2-7', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Kamar mandi PIC' },
  { id: 'gc-2-8', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Mushola' },
  { id: 'gc-2-9', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Storing Kebersihan Halaman' },
  { id: 'gc-2-10', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Pengisian Galon' },
  { id: 'gc-2-11', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan area dalam Gudang Inbound' },
  { id: 'gc-2-12', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan area halaman Gudang Inbound-Gateway' },
  { id: 'gc-2-13', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan area Halaman Adm Inbound-Pos Scurity' },
  { id: 'gc-2-14', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Kamar Mandi Depan (Diki Kharisma)' },
  { id: 'gc-2-15', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 2', kegiatan: 'Lain – Lain' },

  // Gudang Cibitung - Shift 3
  { id: 'gc-3-1', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan ruangan SCO' },
  { id: 'gc-3-2', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan Meja dan Komputer ruangan SCO' },
  { id: 'gc-3-3', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan ruangan GA' },
  { id: 'gc-3-4', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan Meja dan Komputer ruangan GA' },
  { id: 'gc-3-5', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan ruangan TS – BRINKS' },
  { id: 'gc-3-6', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan Tempat sampah All area' },
  { id: 'gc-3-7', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan Kamar Mandi Depan' },
  { id: 'gc-3-8', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Pengambilan karung Inbound' },
  { id: 'gc-3-9', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan ruangan Comsup' },
  { id: 'gc-3-10', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan Meja dan Komputer ruangan Comsup' },
  { id: 'gc-3-11', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Storing kebersihan Smoking Area' },
  { id: 'gc-3-12', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan area Receiving Outbound' },
  { id: 'gc-3-13', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Pengambilan karung Pick-up outbound' },
  { id: 'gc-3-14', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan All area Halaman' },
  { id: 'gc-3-15', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Sortir Karung' },
  { id: 'gc-3-16', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan Kamar mandi PIC' },
  { id: 'gc-3-17', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan Mushola' },
  { id: 'gc-3-18', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Kebersihan Tempat sampah All Gudang' },
  { id: 'gc-3-19', lokasi: 'Gudang Cibitung', shiftKerja: 'Shift 3', kegiatan: 'Lain – Lain' },

  // HO Grandwisata - Shift 1
  { id: 'ho-1-1', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan ALL Ruangan Lantai 1' },
  { id: 'ho-1-2', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Meja dan Komputer SCO' },
  { id: 'ho-1-3', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Meja dan Komputer ruangan Bu Leni' },
  { id: 'ho-1-4', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Storing AC dan Lampu ALL Gedung' },
  { id: 'ho-1-5', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Kamar Mandi Lantai 1 WIC' },
  { id: 'ho-1-6', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Kamar Mandi Lantai 1 R. Meeting' },
  { id: 'ho-1-7', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Kamar Mandi Lantai 2 HC' },
  { id: 'ho-1-8', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Kamar Mandi Lantai 2 CS' },
  { id: 'ho-1-9', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Kamar Mandi Lantai 3 Sales' },
  { id: 'ho-1-10', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Kamar Mandi Lantai 3 Finance' },
  { id: 'ho-1-11', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Kaca depan SCO - WIC' },
  { id: 'ho-1-12', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Pengisian Galon' },
  { id: 'ho-1-13', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan dan Pel Lantai ALL Gedung' },
  { id: 'ho-1-14', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Storing Kebersihan' },
  { id: 'ho-1-15', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Storing Air Pembuangan ALL AC' },
  { id: 'ho-1-16', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Pembuangan Sampah ALL Ruangan' },
  { id: 'ho-1-17', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan dan Pel Lantai ALL Ruangan' },
  { id: 'ho-1-18', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Kebersihan Halaman' },
  { id: 'ho-1-19', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 1', kegiatan: 'Lain – Lain' },

  // HO Grandwisata - Shift 2
  { id: 'ho-2-1', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Kamar Mandi Lantai 1 WIC' },
  { id: 'ho-2-2', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Kamar Mandi Lantai 1 R. Meeting' },
  { id: 'ho-2-3', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Kamar Mandi Lantai 2 HC' },
  { id: 'ho-2-4', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Kamar Mandi Lantai 2 CS' },
  { id: 'ho-2-5', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Kamar Mandi Lantai 3 Sales' },
  { id: 'ho-2-6', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Kamar Mandi Lantai 3 Finance' },
  { id: 'ho-2-7', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan dan Pel Lantai ALL Gedung' },
  { id: 'ho-2-8', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Storing Kebersihan' },
  { id: 'ho-2-9', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Kaca depan SCO – WIC' },
  { id: 'ho-2-10', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Pengisian Galon' },
  { id: 'ho-2-11', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan ALL Ruangan' },
  { id: 'ho-2-12', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Meja dan Komputer ALL Ruangan' },
  { id: 'ho-2-13', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Pembuangan Sampah ALL ruangan' },
  { id: 'ho-2-14', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Kebersihan Halaman' },
  { id: 'ho-2-15', lokasi: 'HO Grandwisata', shiftKerja: 'Shift 2', kegiatan: 'Lain – Lain' },
];

const DEFAULT_ADMIN: UserAccount = {
  id: 'admin-1',
  username: 'admin',
  pin: '1234',
  name: 'Administrator',
  role: 'Admin'
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [view, setView] = useState<AppView>('Login');
  
  const handleSetView = (newView: AppView) => {
    setSearchQuery('');
    setView(newView);
  };

  const [dailyJobs, setDailyJobs] = useState<DailyJob[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [masterJobs, setMasterJobs] = useState<MasterJob[]>([]);
  const [preFillData, setPreFillData] = useState<Partial<DailyJob> | null>(null);
  const [adminStaffFilter, setAdminStaffFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // If logged in via Google, find matching account in Firestore
        try {
          const q = query(collection(db, 'users'), where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as UserAccount;
            setCurrentUser(userData);
            handleSetView('Home');
          } else if (user.email === 'mamadollay95@gmail.com') {
            // Bootstrap admin
            const adminUser: UserAccount = {
              id: user.uid,
              username: 'admin',
              pin: '1234',
              name: 'Administrator',
              role: 'Admin',
              email: user.email!
            };
            setCurrentUser(adminUser);
            // Optionally save to Firestore if not exists
            await setDoc(doc(db, 'users', user.uid), adminUser);
            handleSetView('Home');
          } else {
            // Logged in but no profile found
            // Maybe it's a first time user, but we'll ask admin to add them
            setCurrentUser(null);
            auth.signOut();
            alert('Akun anda belum terdaftar. Silahkan hubungi Admin.');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'users');
        }
      } else {
        setCurrentUser(null);
        handleSetView('Login');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!currentUser) return;

    // Listen to Daily Jobs
    const qJobs = query(collection(db, 'dailyJobs'), orderBy('tanggal', 'desc'), limit(100));
    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyJob));
      setDailyJobs(jobs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'dailyJobs'));

    // Listen to Users (Admin only)
    let unsubUsers = () => {};
    if (currentUser.role === 'Admin') {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const staff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAccount));
        setUsers(staff);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    }

    // Listen to Master Jobs
    const unsubMaster = onSnapshot(collection(db, 'masterJobs'), (snapshot) => {
      const masters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterJob));
      // If Firestore is empty, seed with initial data
      if (masters.length === 0 && currentUser.role === 'Admin') {
        INITIAL_MASTER_JOBS.forEach(async (job) => {
          await setDoc(doc(db, 'masterJobs', job.id), job);
        });
      }
      setMasterJobs(masters.length > 0 ? masters : INITIAL_MASTER_JOBS);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'masterJobs'));

    return () => {
      unsubJobs();
      unsubUsers();
      unsubMaster();
    };
  }, [currentUser]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert('Gagal login: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      setCurrentUser(null);
      handleSetView('Login');
    } catch (error) {
      console.error(error);
    }
  };

  const addDailyJob = async (job: DailyJob) => {
    if (!db) {
      throw new Error('Database is not initialized');
    }
    try {
      const docRef = doc(db, 'dailyJobs', job.id);
      await setDoc(docRef, job);
      setPreFillData(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'dailyJobs');
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const syncMasterJobs = async () => {
    if (currentUser?.role !== 'Admin') {
      console.warn('Sync attempt by non-admin');
      return;
    }
    
    setIsSyncing(true);
    console.log('Syncing Master Jobs...', INITIAL_MASTER_JOBS.length, 'items');
    
    try {
      const batch = writeBatch(db);
      INITIAL_MASTER_JOBS.forEach(job => {
        batch.set(doc(db, 'masterJobs', job.id), job);
      });
      await batch.commit();
      console.log('Sync successful');
      alert('Daftar tugas berhasil diperbarui dari template!');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Gagal memperbarui data: ' + (error instanceof Error ? error.message : String(error)));
      // Still call handleFirestoreError for reporting if needed
      try {
        handleFirestoreError(error, OperationType.WRITE, 'masterJobs');
      } catch (e) {
        // handleFirestoreError throws, so we ignore the throw since we already alerted
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const [selectedJobForFinish, setSelectedJobForFinish] = useState<DailyJob | null>(null);

  const updateDailyJob = async (id: string, updates: Partial<DailyJob>) => {
    try {
      await setDoc(doc(db, 'dailyJobs', id), updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dailyJobs/${id}`);
    }
  };

  const deleteDailyJob = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'dailyJobs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `dailyJobs/${id}`);
    }
  };

  const addUser = async (user: UserAccount) => {
    try {
      await setDoc(doc(db, 'users', user.id), user);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const deleteUser = async (id: string) => {
    if (id === currentUser?.id) return alert('Tidak bisa menghapus user yang sedang aktif');
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const [isAddingMasterJob, setIsAddingMasterJob] = useState(false);
  const [newMasterJob, setNewMasterJob] = useState({
    lokasi: '',
    shiftKerja: 'Shift 1A' as Shift,
    kegiatan: ''
  });

  const handleAddMasterJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterJob.lokasi || !newMasterJob.kegiatan) {
      alert('Harap isi Lokasi dan Kegiatan');
      return;
    }

    await addMasterJob({
      id: `custom-${Math.random().toString(36).substr(2, 5)}`,
      ...newMasterJob
    });
    
    setNewMasterJob({ lokasi: '', shiftKerja: 'Shift 1A', kegiatan: '' });
    setIsAddingMasterJob(false);
  };

  const addMasterJob = async (job: MasterJob) => {
    try {
      await setDoc(doc(db, 'masterJobs', job.id), job);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'masterJobs');
    }
  };

  const deleteMasterJob = async (id: string) => {
    if (!window.confirm('Hapus tugas ini?')) return;
    try {
      await deleteDoc(doc(db, 'masterJobs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `masterJobs/${id}`);
    }
  };

  const getFilteredJobs = () => {
    let jobs = dailyJobs;
    
    if (currentUser?.role === 'Staff') {
      // Staff only sees their own work
      jobs = dailyJobs.filter(j => j.pic === currentUser.name);
    } else if (currentUser?.role === 'Admin' && adminStaffFilter !== 'all') {
      // Admin filtered by staff
      jobs = dailyJobs.filter(j => j.pic === adminStaffFilter);
    }
    
    return jobs;
  };

  const visibleJobs = getFilteredJobs();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inisialisasi Sistem...</p>
      </div>
    );
  }

  if (view === 'Login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 max-w-md mx-auto relative overflow-hidden flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 px-6 py-4 z-30 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-3">
          {view !== 'Home' && (
            <button 
              onClick={() => handleSetView('Home')}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-sm font-extrabold tracking-tight uppercase text-slate-900">
              {view === 'Home' && 'MAMADOLLAY APPS'}
              {view === 'DailyJobForm' && 'Laporan Baru'}
              {view === 'DailyJobList' && 'Daftar Laporan'}
              {view === 'MasterJobList' && 'Daftar Tugas'}
              {view === 'UserManagement' && 'Manajemen Staff'}
              {view === 'Reports' && 'Statistik & Laporan'}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {currentUser?.name}
              </p>
            </div>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-md mx-auto px-5 py-6 pb-28">
          <AnimatePresence mode="wait">
            {view === 'Home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                {/* Hero Stat */}
                <div className="relative p-6 rounded-[2.5rem] bg-indigo-600 text-white overflow-hidden shadow-xl shadow-indigo-100">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                  <div className="relative z-10">
                    <h2 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Status Hari Ini</h2>
                    <p className="text-3xl font-black mb-4 leading-tight">MAMADOLLAY <br/> Housekeeping</p>
                    
                    <div className="flex gap-2">
                      <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 uppercase">
                        <ClipboardList size={12} />
                        {dailyJobs.length} Aktivitas
                      </div>
                      {currentUser?.role === 'Admin' && (
                        <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 uppercase">
                          <Users size={12} />
                          {users.length} Petugas
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <MenuCard 
                    onClick={() => handleSetView('DailyJobList')}
                    icon={<Calendar className="text-indigo-600" />}
                    label="Daily Log"
                    color="bg-indigo-50"
                  />
                  <MenuCard 
                    onClick={() => handleSetView('MasterJobList')}
                    icon={<ClipboardList className="text-amber-600" />}
                    label="Daftar Tugas"
                    color="bg-amber-50"
                  />
                  <MenuCard 
                    onClick={() => handleSetView('Reports')}
                    icon={<BarChart3 className="text-rose-600" />}
                    label="Laporan"
                    color="bg-rose-50"
                  />
                  {currentUser?.role === 'Admin' && (
                    <MenuCard 
                      onClick={() => handleSetView('UserManagement')}
                      icon={<Users className="text-emerald-600" />}
                      label="Staff"
                      color="bg-emerald-50"
                    />
                  )}
                </div>
              </motion.div>
            )}

          {view === 'DailyJobList' && (
            <motion.div
              key="daily-list"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-black text-slate-900">Histori Kerja</h2>
                <button 
                  onClick={() => handleSetView('DailyJobForm')}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100 uppercase"
                >
                  <Plus size={16} />
                  Tambah
                </button>
              </div>

              {currentUser?.role === 'Admin' && (
                <div className="bg-white px-4 py-1.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <Users size={16} className="text-slate-400" />
                  <select 
                    value={adminStaffFilter}
                    onChange={(e) => setAdminStaffFilter(e.target.value)}
                    className="flex-1 bg-transparent text-[10px] font-bold uppercase focus:outline-none py-2"
                  >
                    <option value="all">SEMUA PETUGAS</option>
                    {users.filter(u => u.role === 'Staff').map(u => (
                      <option key={u.id} value={u.name}>{u.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}

              {visibleJobs.length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                    <FileText size={32} />
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Belum ada data aktivitas</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {visibleJobs.map((job) => (
                    <div key={job.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase">{job.shift}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{job.tanggal}</span>
                            </div>
                            <h3 className="font-extrabold text-slate-900 text-lg leading-snug">{job.kegiatan}</h3>
                            <div className="flex items-center gap-1.5 text-slate-500 mt-2">
                              <MapPin size={12} className="text-indigo-400" />
                              <span className="text-[10px] font-bold uppercase">{job.lokasi}</span>
                            </div>
                            <div className="text-[9px] font-bold text-slate-400 mt-3 flex items-center gap-1.5">
                              <div className="w-1 h-1 bg-slate-300 rounded-full" />
                              PIC: {job.pic}
                            </div>
                          </div>
                          {(currentUser?.role === 'Admin' || (currentUser?.role === 'Staff' && job.pic === currentUser?.name)) && (
                            <button 
                              onClick={() => deleteDailyJob(job.id)}
                              className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>

                        {job.waktuSelesai === '-' ? (
                          <div className="py-6 border-y border-slate-50 mb-4 text-center">
                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
                              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                              Sedang Dikerjakan (Mulai: {job.waktuMulai})
                            </p>
                            <button 
                              onClick={() => setSelectedJobForFinish(job)}
                              className="w-full bg-emerald-600 text-white py-4 rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                              <CheckCircle2 size={18} />
                              Selesaikan Laporan
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 gap-4 py-4 border-y border-slate-50 mb-4">
                              <div>
                                <span className="block text-[8px] uppercase font-bold text-slate-400 mb-0.5">Mulai</span>
                                <span className="text-xs font-bold text-slate-900">{job.waktuMulai}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] uppercase font-bold text-slate-400 mb-0.5">Selesai</span>
                                <span className="text-xs font-bold text-slate-900">{job.waktuSelesai}</span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[8px] uppercase font-bold text-slate-400 mb-0.5">Durasi</span>
                                <span className="text-xs font-extrabold text-indigo-600">{job.durasi}</span>
                              </div>
                            </div>

                            {job.foto && (
                              <div className="rounded-2xl overflow-hidden mb-4 border border-slate-100">
                                <img src={job.foto} alt="Bukti" className="w-full h-48 object-cover hover:scale-105 transition-transform duration-500" />
                              </div>
                            )}
                            {job.keterangan && (
                              <div className="p-4 bg-slate-50 rounded-2xl">
                                <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed">
                                  "{job.keterangan}"
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'DailyJobForm' && (
            <motion.div
              key="daily-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <DailyForm 
                masterJobs={masterJobs} 
                onSubmit={addDailyJob} 
                onCancel={() => { handleSetView('DailyJobList'); setPreFillData(null); }} 
                initialData={preFillData ? { ...preFillData, pic: currentUser?.name } : { pic: currentUser?.name }}
              />
            </motion.div>
          )}

          {view === 'Reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ReportsView 
                dailyJobs={visibleJobs} 
                currentUser={currentUser!}
                staffFilter={adminStaffFilter}
                setStaffFilter={setAdminStaffFilter}
                users={users}
              />
            </motion.div>
          )}

          {view === 'MasterJobList' && (
            <motion.div
              key="master-list"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-slate-900">Daftar Tugas</h2>
                {currentUser?.role === 'Admin' && (
                  <button 
                    onClick={() => setIsAddingMasterJob(!isAddingMasterJob)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95 shadow-lg shadow-indigo-100 uppercase ${
                      isAddingMasterJob ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isAddingMasterJob ? 'Batal' : (
                      <>
                        <Plus size={16} />
                        Tambah
                      </>
                    )}
                  </button>
                )}
              </div>

              {isAddingMasterJob && (
                <motion.form 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleAddMasterJob}
                  className="bg-white p-6 rounded-[2.5rem] border border-indigo-100 shadow-xl shadow-indigo-50/50 space-y-4 border-2"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi</label>
                      <input 
                        type="text" 
                        placeholder="Contoh: Gudang Cibitung"
                        value={newMasterJob.lokasi}
                        onChange={e => setNewMasterJob({...newMasterJob, lokasi: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] font-bold uppercase focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Shift</label>
                      <select 
                        value={newMasterJob.shiftKerja}
                        onChange={e => setNewMasterJob({...newMasterJob, shiftKerja: e.target.value as any})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] font-bold uppercase appearance-none focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      >
                        <option value="Shift 1A">Shift 1A</option>
                        <option value="Shift 1B">Shift 1B</option>
                        <option value="Shift 2">Shift 2</option>
                        <option value="Shift 3">Shift 3</option>
                        <option value="Shift 1">Shift 1</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Kegiatan</label>
                    <textarea 
                      placeholder="Contoh: Kebersihan Ruang ADM"
                      value={newMasterJob.kegiatan}
                      onChange={e => setNewMasterJob({...newMasterJob, kegiatan: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] font-bold uppercase focus:ring-2 focus:ring-indigo-100 outline-none transition-all min-h-[60px]"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                  >
                    Simpan Tugas Baru
                  </button>
                </motion.form>
              )}

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Cari lokasi atau kegiatan..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-[11px] font-bold uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between pl-1">
                  <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-left">Daftar Tugas Standar</h2>
                  {currentUser?.role === 'Admin' && (
                    <button 
                      onClick={syncMasterJobs}
                      disabled={isSyncing}
                      className={`text-[9px] font-bold uppercase hover:underline transition-colors ${isSyncing ? 'text-slate-300' : 'text-indigo-600'}`}
                    >
                      {isSyncing ? 'Memproses...' : 'Reset Default'}
                    </button>
                  )}
                </div>
                <div className="space-y-5">
                  {masterJobs
                    .filter(job => 
                      job.kegiatan.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      job.lokasi.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      job.shiftKerja.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((job) => (
                    <div key={job.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase ${
                            job.shiftKerja.includes('1A') ? 'bg-amber-50 text-amber-600' :
                            job.shiftKerja.includes('1B') ? 'bg-indigo-50 text-indigo-600' :
                            'bg-slate-900 text-white'
                          }`}>
                            {job.shiftKerja}
                          </span>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <MapPin size={12} className="text-indigo-400" />
                            <span className="text-[10px] font-bold uppercase tracking-tight">{job.lokasi}</span>
                          </div>
                        </div>
                        {currentUser?.role === 'Admin' && (
                          <button 
                            onClick={() => deleteMasterJob(job.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-snug mb-5">{job.kegiatan}</h3>
                      <button 
                        onClick={() => {
                          setPreFillData({
                            lokasi: job.lokasi,
                            shift: job.shiftKerja,
                            kegiatan: job.kegiatan
                          });
                          handleSetView('DailyJobForm');
                        }}
                        className="w-full bg-slate-900 border border-slate-900 py-3 rounded-2xl text-white text-[10px] font-bold uppercase hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-100"
                      >
                        <PlusCircle size={16} />
                        Mulai Tugas
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'UserManagement' && currentUser?.role === 'Admin' && (
            <motion.div
              key="user-mgmt"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <h2 className="text-xl font-black text-slate-900">Manajemen Staff</h2>
              
              <AddUserForm onAdd={addUser} />

              <div className="space-y-4">
                <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Petugas Terdaftar</h3>
                <div className="space-y-4">
                  {users.map(u => (
                    <div key={u.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm ${u.role === 'Admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm uppercase">{u.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{u.role} • PIN: {u.pin}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteUser(u.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {selectedJobForFinish && (
          <FinishJobModal 
            job={selectedJobForFinish} 
            onClose={() => setSelectedJobForFinish(null)}
            onFinish={async (updates) => {
              await updateDailyJob(selectedJobForFinish.id, updates);
              setSelectedJobForFinish(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <nav className="bg-white/80 backdrop-blur-lg px-6 py-4 fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm flex items-center justify-between z-40 rounded-[2.5rem] shadow-2xl shadow-indigo-200/50 border border-white/20">
        <NavButton 
          active={view === 'Home'} 
          onClick={() => handleSetView('Home')} 
          icon={<Home size={20} />} 
          label="Home" 
        />
        <NavButton 
          active={view === 'DailyJobList' || view === 'DailyJobForm'} 
          onClick={() => handleSetView('DailyJobList')} 
          icon={<Calendar size={20} />} 
          label="Logs" 
        />
        <NavButton 
          active={view === 'Reports'} 
          onClick={() => handleSetView('Reports')} 
          icon={<BarChart3 size={20} />} 
          label="Stats" 
        />
        <NavButton 
          active={view === 'MasterJobList'} 
          onClick={() => handleSetView('MasterJobList')} 
          icon={<ClipboardList size={20} />} 
          label="Jobs" 
        />
      </nav>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (un: string, pin: string) => void }) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
      alert('Login gagal. Silahkan coba lagi.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 max-w-md mx-auto flex flex-col p-8 overflow-hidden">
      <div className="flex-1 flex flex-col justify-center max-w-xs mx-auto w-full gap-16">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-100 rotate-6 hover:rotate-0 transition-transform duration-500">
            <Lock size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900">MAMADOLLAY <br/> <span className="text-indigo-600 font-extrabold">APPS</span></h1>
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-[0.4em]">Management System</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">Selamat Datang</p>
            <p className="text-xs font-medium text-slate-400 px-4 leading-relaxed">
              Sistem Pelaporan Housekeeping Digital untuk efisiensi operasional petugas.
            </p>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white text-slate-900 font-bold py-4 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 transition-all hover:shadow-indigo-100 active:scale-95 text-xs uppercase flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            {isLoggingIn ? 'Memproses...' : 'Masuk dengan Google'}
          </button>
        </div>

        <p className="text-center text-[9px] font-extrabold text-slate-300 uppercase tracking-widest mt-12">
          © 2026 MAMADOLLAY MULTISERVICES
        </p>
      </div>
    </div>
  );
}

function AddUserForm({ onAdd }: { onAdd: (u: UserAccount) => void }) {
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    pin: '',
    email: '',
    role: 'Staff' as 'Staff' | 'Admin'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.pin || !formData.name || !formData.email) return alert('Lengkapi data termasuk Email');
    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      ...formData
    });
    setFormData({ username: '', name: '', pin: '', email: '', role: 'Staff' });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
      <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-widest pl-1">Tambah Petugas</h3>
      <div className="grid grid-cols-2 gap-4">
        <input 
          placeholder="USER" 
          value={formData.username}
          onChange={e => setFormData({...formData, username: e.target.value})}
          className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[10px] font-bold uppercase focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
        />
        <input 
          placeholder="PIN (4 DIGIT)" 
          maxLength={4}
          value={formData.pin}
          onChange={e => setFormData({...formData, pin: e.target.value})}
          className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[10px] font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
        />
      </div>
      <input 
        placeholder="EMAIL GOOGLE" 
        type="email"
        value={formData.email}
        onChange={e => setFormData({...formData, email: e.target.value})}
        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[10px] font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
      />
      <input 
        placeholder="NAMA LENGKAP" 
        value={formData.name}
        onChange={e => setFormData({...formData, name: e.target.value})}
        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[10px] font-bold uppercase focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
      />
      <div className="flex gap-3">
        <select 
          value={formData.role}
          onChange={e => setFormData({...formData, role: e.target.value as any})}
          className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[10px] font-bold uppercase appearance-none focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
        >
          <option value="Staff">STAFF</option>
          <option value="Admin">ADMIN</option>
        </select>
        <button type="submit" className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-2xl text-[10px] uppercase transition-all hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100">
          Simpan
        </button>
      </div>
    </form>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all flex-1 py-1 ${
        active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <div className={`transition-all duration-300 ${active ? 'scale-110' : 'scale-100'}`}>
        {icon}
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-wide transition-opacity ${active ? 'opacity-100' : 'opacity-70'}`}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="nav-dot"
          className="w-1 h-1 bg-indigo-600 rounded-full"
        />
      )}
    </button>
  );
}

function MenuCard({ onClick, icon, label, color }: { onClick: () => void, icon: React.ReactNode, label: string, color: string }) {
  return (
    <button 
      onClick={onClick}
      className={`${color} p-6 rounded-[2rem] flex flex-col items-center justify-center gap-4 aspect-square transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow-md group`}
    >
      <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:shadow-md transition-all">
        {React.cloneElement(icon as React.ReactElement, { size: 28 })}
      </div>
      <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800">{label}</span>
    </button>
  );
}

function DailyForm({ masterJobs, onSubmit, onCancel, initialData }: { masterJobs: MasterJob[], onSubmit: (job: DailyJob) => Promise<void>, onCancel: () => void, initialData?: Partial<DailyJob> }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchKegiatan, setSearchKegiatan] = useState('');
  const [formData, setFormData] = useState<Partial<DailyJob>>({
    tanggal: new Date().toISOString().split('T')[0],
    shift: 'Shift 1A',
    waktuMulai: '',
    waktuSelesai: '',
    pic: '',
    lokasi: '',
    kegiatan: '',
    keterangan: '',
    ...initialData
  });

  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Capture start time on mount if not provided by initialData
  useEffect(() => {
    if (!formData.waktuMulai) {
      setFormData(prev => ({ ...prev, waktuMulai: getCurrentTime() }));
    }
  }, []);

  // Unique locations from master jobs
  const locations = Array.from(new Set(masterJobs.map(j => j.lokasi))).sort();
  
  // Shifts available for selected location
  const availableShifts = formData.lokasi 
    ? Array.from(new Set(masterJobs.filter(j => j.lokasi === formData.lokasi).map(j => j.shiftKerja))).sort()
    : Array.from(new Set(masterJobs.map(j => j.shiftKerja))).sort();

  // Activities filtered by location and shift
  const filteredKegiatan = masterJobs.filter(j => 
    (!formData.lokasi || j.lokasi === formData.lokasi) && 
    (!formData.shift || j.shiftKerja === formData.shift)
  ).map(j => j.kegiatan).sort();

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // 60% quality jpeg
      };
    });
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64);
        setImagePreview(compressed);
        setFormData({ ...formData, foto: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end || end === '-') return '-';
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diffInMinutes = (eh * 60 + em) - (sh * 60 + sm);
      if (diffInMinutes < 0) diffInMinutes += 24 * 60;
      
      const h = Math.floor(diffInMinutes / 60);
      const m = diffInMinutes % 60;
      return `${h > 0 ? `${h} jam ` : ''}${m} menit`;
    } catch (e) {
      return '-';
    }
  };

  const handleMulai = () => {
    setFormData({ ...formData, waktuMulai: getCurrentTime() });
  };

  const handleSelesai = () => {
    setFormData({ ...formData, waktuSelesai: getCurrentTime() });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || showSuccess) return;

    if (!formData.lokasi || !formData.kegiatan || !formData.pic) {
      alert('Harap isi field Lokasi, Kegiatan, dan PIC');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const startTime = `${hours}:${minutes}`;

      const job: DailyJob = {
        id: Math.random().toString(36).substr(2, 9),
        tanggal: formData.tanggal!,
        pic: formData.pic!,
        lokasi: formData.lokasi!,
        shift: formData.shift as Shift,
        kegiatan: formData.kegiatan!,
        waktuMulai: startTime,
        waktuSelesai: '-',
        foto: '',
        keterangan: '',
        durasi: '-',
      };
      
      await onSubmit(job);
      setShowSuccess(true);
      setTimeout(() => {
        onCancel();
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Gagal menyimpan laporan: ${errorMessage}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-white/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-indigo-200 border border-indigo-50 flex flex-col items-center text-center max-w-xs w-full"
            >
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-6 shadow-lg shadow-emerald-200">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 uppercase">Laporan Dimulai!</h3>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Waktu mulai telah dicatat.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className={`space-y-6 transition-all duration-500 ${showSuccess ? 'blur-md grayscale opacity-50 pointer-events-none' : ''}`}>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tanggal</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={14} />
                <input 
                  type="date" 
                  value={formData.tanggal}
                  readOnly
                  className="w-full bg-slate-100 border border-slate-100 rounded-2xl py-3 pl-9 pr-3 text-xs font-bold focus:outline-none transition-all cursor-default"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nama PIC</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={14} />
                <input 
                  type="text" 
                  placeholder="NAMA PIC"
                  readOnly
                  value={formData.pic}
                  className="w-full bg-slate-100 border border-slate-100 rounded-2xl py-3 pl-9 pr-3 text-xs font-bold uppercase focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Lokasi</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={14} />
                <select 
                  value={formData.lokasi}
                  onChange={(e) => setFormData({ ...formData, lokasi: e.target.value, kegiatan: '' })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-9 pr-3 text-[10px] font-black uppercase appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all shadow-sm"
                >
                  <option value="">- PILIH LOKASI -</option>
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Shift</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={14} />
                <select 
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value as Shift, kegiatan: '' })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-9 pr-3 text-[10px] font-black uppercase appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all shadow-sm"
                >
                  <option value="">- PILIH SHIFT -</option>
                  {availableShifts.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2 relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Kegiatan</label>
            <div className="relative">
              <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none z-10" size={14} />
              <input 
                type="text"
                placeholder={!formData.lokasi || !formData.shift ? "- PILIH LOKASI & SHIFT DULU -" : (formData.kegiatan || "- CARI / PILIH KEGIATAN -")}
                value={searchKegiatan}
                onChange={(e) => {
                  setSearchKegiatan(e.target.value);
                  setFormData({ ...formData, kegiatan: e.target.value });
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-9 pr-3 text-[10px] font-black uppercase focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all shadow-inner placeholder:text-slate-900"
                disabled={!formData.lokasi || !formData.shift}
              />
              
              <AnimatePresence>
                {isDropdownOpen && (formData.lokasi && formData.shift) && (
                  <>
                    <div className="fixed inset-0 z-0" onClick={() => setIsDropdownOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto"
                    >
                      {filteredKegiatan.filter(k => k.toLowerCase().includes(searchKegiatan.toLowerCase())).length > 0 ? (
                        filteredKegiatan
                          .filter(k => k.toLowerCase().includes(searchKegiatan.toLowerCase()))
                          .map((k, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, kegiatan: k });
                                setSearchKegiatan('');
                                setIsDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase hover:bg-indigo-50 border-b border-slate-50 last:border-0"
                            >
                              {k}
                            </button>
                          ))
                      ) : (
                        <div className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-center py-6">Tidak ditemukan</div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex gap-4 px-2 relative z-10">
          <button 
            type="button" 
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-4 rounded-[2rem] bg-white border border-slate-100 text-slate-400 font-bold text-[11px] uppercase transition-all hover:bg-slate-50 active:scale-95 shadow-sm disabled:opacity-50"
          >
            Batal
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="flex-1 py-4 rounded-[2rem] bg-slate-900 text-white font-bold text-[11px] uppercase transition-all hover:bg-slate-800 active:scale-95 shadow-xl shadow-slate-100 disabled:opacity-80 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Mulai...
              </>
            ) : (
              <>
                <PlusCircle size={18} />
                Mulai Laporan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function FinishJobModal({ job, onClose, onFinish }: { job: DailyJob, onClose: () => void, onFinish: (updates: Partial<DailyJob>) => Promise<void> }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [keterangan, setKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end || end === '-') return '-';
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diffInMinutes = (eh * 60 + em) - (sh * 60 + sm);
      if (diffInMinutes < 0) diffInMinutes += 24 * 60;
      const h = Math.floor(diffInMinutes / 60);
      const m = diffInMinutes % 60;
      return `${h > 0 ? `${h} jam ` : ''}${m} menit`;
    } catch (e) {
      return '-';
    }
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setImagePreview(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!imagePreview) return alert('Bukti foto wajib dilampirkan!');
    setIsSubmitting(true);
    try {
      const endTime = getCurrentTime();
      const updates = {
        waktuSelesai: endTime,
        foto: imagePreview,
        keterangan: keterangan,
        durasi: calculateDuration(job.waktuMulai, endTime)
      };
      await onFinish(updates);
    } catch (error) {
      alert('Gagal menyelesaikan laporan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-white w-full max-w-md rounded-t-[3rem] p-8 pb-10 space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Selesaikan Laporan</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{job.kegiatan}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bukti Foto (Wajib)</label>
            <input 
              type="file" accept="image/*" capture="environment" 
              className="hidden" ref={fileInputRef} onChange={handleImageCapture}
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[160px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-indigo-50/30 hover:border-indigo-200 transition-all overflow-hidden"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Bukti" className="w-full h-full object-cover max-h-64" />
              ) : (
                <>
                  <div className="p-4 bg-white rounded-full shadow-sm text-indigo-400">
                    <ImageIcon size={24} />
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Sentuh untuk ambil foto</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Catatan Tambahan</label>
            <textarea 
              placeholder="Ceritakan apa yang sudah dikerjakan..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] py-4 px-6 text-xs font-bold focus:ring-2 focus:ring-indigo-100 focus:bg-white outline-none transition-all min-h-[100px]"
            />
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || !imagePreview}
          className="w-full bg-emerald-600 text-white font-black py-5 rounded-[2rem] text-xs uppercase shadow-xl shadow-emerald-100 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting ? 'Memproses...' : 'Konfirmasi Selesai'}
        </button>
      </motion.div>
    </div>
  );
}

function ReportsView({ 
  dailyJobs, 
  currentUser, 
  staffFilter, 
  setStaffFilter,
  users 
}: { 
  dailyJobs: DailyJob[], 
  currentUser: UserAccount,
  staffFilter: string,
  setStaffFilter: (s: string) => void,
  users: UserAccount[]
}) {
  const exportToCSV = () => {
    if (dailyJobs.length === 0) return alert('Tidak ada data untuk di-export');
    
    // Proper CSV escaping
    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return '""';
      const escaped = String(str).replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const headers = ['ID', 'Tanggal', 'PIC', 'Lokasi', 'Shift', 'Kegiatan', 'Waktu Mulai', 'Waktu Selesai', 'Durasi', 'Keterangan'];
    const rows = dailyJobs.map(job => [
      job.id,
      job.tanggal,
      job.pic,
      job.lokasi,
      job.shift,
      job.kegiatan,
      job.waktuMulai,
      job.waktuSelesai,
      job.durasi,
      job.keterangan || ''
    ].map(val => escapeCSV(val)));
    
    const csvContent = [
      headers.map(h => escapeCSV(h)).join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `housekeeping_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalJobs = dailyJobs.length;
  const jobsByShift = dailyJobs.reduce((acc: Record<string, number>, job) => {
    acc[job.shift] = (acc[job.shift] || 0) + 1;
    return acc;
  }, {});

  const jobsByLocation = dailyJobs.reduce((acc: Record<string, number>, job) => {
    acc[job.lokasi] = (acc[job.lokasi] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8 pb-12">
      {currentUser.role === 'Admin' && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 flex items-center justify-center rounded-xl text-indigo-600">
              <Users size={18} />
            </div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-900">Monitor Petugas</h3>
          </div>
          <select 
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-[11px] font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all appearance-none shadow-inner"
          >
            <option value="all">SEMUA PETUGAS</option>
            {users.filter(u => u.role === 'Staff').map(u => (
              <option key={u.id} value={u.name}>{u.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Total Entri</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-black text-slate-900">{totalJobs}</p>
            <p className="text-[10px] font-bold text-slate-400">Jobs</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Shift Aktif</p>
          <p className="text-lg font-black text-slate-900 truncate">
            {Object.entries(jobsByShift).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '-'}
          </p>
        </div>
      </div>

      <button 
        onClick={exportToCSV}
        className="w-full bg-slate-900 text-white font-bold py-4 rounded-[2rem] transition-all hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-3 uppercase text-xs shadow-xl shadow-slate-100"
      >
        <Download size={18} />
        Ekspor Data CSV
      </button>

      <div className="space-y-4">
        <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-2">Aktivitas Terkini</h3>
        {dailyJobs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-[10px] font-extrabold uppercase tracking-widest bg-white border border-dashed border-slate-200 rounded-[2.5rem]">
            Belum ada data aktivitas
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-5 py-4 text-[9px] font-extrabold uppercase text-slate-400 tracking-widest">Tgl</th>
                    <th className="px-5 py-4 text-[9px] font-extrabold uppercase text-slate-400 tracking-widest">PIC</th>
                    <th className="px-5 py-4 text-[9px] font-extrabold uppercase text-slate-400 tracking-widest">Kegiatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dailyJobs.slice(0, 10).map(job => (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 text-[10px] font-bold text-slate-600">{job.tanggal.split('-').slice(1).reverse().join('/')}</td>
                      <td className="px-5 py-4 text-[10px] font-bold text-slate-900">{job.pic}</td>
                      <td className="px-5 py-4 text-[10px] font-bold text-slate-600 truncate max-w-[140px]">{job.kegiatan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dailyJobs.length > 10 && (
              <div className="p-3 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-t border-slate-100">
                + {dailyJobs.length - 10} entri lainnya
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3">Distribusi Lokasi</h3>
        <div className="space-y-4">
          {Object.entries(jobsByLocation).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([loc, count]: [string, any]) => (
            <div key={loc} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-700 truncate max-w-[180px]">{loc}</span>
                <span className="text-[10px] font-extrabold text-indigo-600">{count} Jobs</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / totalJobs) * 100}%` }}
                  className="h-full bg-indigo-500 rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
