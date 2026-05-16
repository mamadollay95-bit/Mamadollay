/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Shift = string;

export interface DailyJob {
  id: string;
  tanggal: string;
  pic: string;
  lokasi: string;
  shift: Shift;
  kegiatan: string;
  waktuMulai: string;
  waktuSelesai: string;
  foto?: string; // Keep for backward compatibility or general use
  fotoMulai?: string;
  fotoSelesai?: string;
  keterangan: string;
  durasi: string; // Calculated or stored
}

export interface MasterJob {
  id: string;
  lokasi: string;
  shiftKerja: Shift;
  kegiatan: string;
}

export type Role = 'Admin' | 'Staff';

export interface UserAccount {
  id: string;
  username: string; // Used as handle/nickname
  pin: string;
  name: string;
  role: Role;
  email?: string; // New field for Firebase Auth
}

export type AppView = 'Home' | 'DailyJobForm' | 'DailyJobList' | 'MasterJobList' | 'UserManagement' | 'Login' | 'Reports' | 'KarungMasuk' | 'KarungMaster';

export interface KarungMaster {
  id: string;
  name: string;
}

export interface KarungMasukItem {
  karungId: string;
  name: string;
  jumlah: number;
}

export interface KarungMasuk {
  id: string;
  tanggal: string;
  pic: string;
  items: KarungMasukItem[];
  createdAt: string;
}
