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
  BarChart3,
  ExternalLink,
  Archive,
  MoreVertical,
  Edit2,
  Trash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppView, DailyJob, MasterJob, Shift, UserAccount, KarungMaster, KarungMasuk, KarungMasukItem } from './types';
import * as XLSX from 'xlsx';

// Firebase Imports
import { db, auth, signInWithGoogle, logOut, storage, getDriveToken, clearDriveToken } from './lib/firebase';
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
import imageCompression from 'browser-image-compression';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import axios from 'axios';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const uploadAndCompressImage = async (file: File, onProgress?: (phase: string, percent: number) => void): Promise<string> => {
  const options = {
    maxSizeMB: 0.2, // Increased from 0.03 to 0.2 to speed up compression
    maxWidthOrHeight: 1200,
    useWebWorker: true, 
    fileType: 'image/jpeg',
    initialQuality: 0.7
  };
  
  try {
    let fileToUpload: File | Blob = file;
    
    try {
      if (onProgress) onProgress('Mengompres...', 5);
      // Timeout 10s for compression
      const compressionPromise = imageCompression(file, options);
      const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
      
      const compressed = await Promise.race([compressionPromise, timeoutPromise]);
      if (compressed) {
        fileToUpload = compressed;
        console.log('Compression complete:', (fileToUpload as File).size / 1024, 'KB');
      }
    } catch (compErr) {
      console.warn('Compression skipped:', compErr);
      if (onProgress) onProgress('Skip Kompresi...', 10);
    }
    
    // 1. Try Google Drive first if token exists
    const driveToken = getDriveToken();
    if (driveToken) {
      try {
        if (onProgress) onProgress('Menyiapkan Google Drive...', 15);
        
        const metadata = {
          name: `mamadollay_${Date.now()}.jpg`,
          mimeType: 'image/jpeg'
        };

        const boundary = '-------mamadollay_upload_boundary';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(fileToUpload);
        });

        const multipartBody = 
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: image/jpeg\r\n' +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          base64Data +
          closeDelimiter;

        if (onProgress) onProgress('Kirim ke Drive...', 30);

        const response = await axios.post(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
          multipartBody,
          {
            headers: {
              'Authorization': `Bearer ${driveToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            timeout: 30000 
          }
        );

        const fileId = response.data.id;
        
        // 2. Set permission to public so thumbnail works everywhere
        try {
          if (onProgress) onProgress('Otorisasi Foto...', 80);
          await axios.post(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
            { role: 'reader', type: 'anyone' },
            { 
              headers: { 'Authorization': `Bearer ${driveToken}` },
              timeout: 10000 
            }
          );
        } catch (permError) {
          console.warn('Failed to set public permission:', permError);
        }

        if (onProgress) onProgress('Hampir Selesai...', 95);
        return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
      } catch (driveError: any) {
        console.error('Drive upload failed, trying fallback...', driveError);
        const status = driveError.response?.status;
        if (status === 401 || status === 403) {
          console.warn('Drive access lost (401/403), clearing token...');
          clearDriveToken();
        }
        // Fallback to Firebase Storage
      }
    }

    if (!auth.currentUser) throw new Error('Otentikasi diperlukan. Silahkan login ulang.');

    if (onProgress) onProgress('Upload ke Cloud...', 40);

    const fileName = `jobs/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, fileName);
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

    return new Promise((resolve, reject) => {
      // Safety timeout for Firebase Storage (60s)
      const safetyTimeout = setTimeout(() => {
        uploadTask.cancel();
        reject(new Error('Upload timeout (60s). Pastikan koneksi stabil.'));
      }, 60000);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress('Mengirim...', Math.round(progress));
        },
        (error) => {
          clearTimeout(safetyTimeout);
          console.error('Cloud Storage error:', error);
          const currentOrigin = window.location.origin;
          
          let msg = 'Gagal upload foto.';
          if (error.message.includes('CORS') || error.code === 'storage/unknown' || error.message.includes('failed')) {
            msg = `KONEKSI DITOLAK (CORS). Domain "${currentOrigin}" belum diizinkan di Firebase Storage.\n\nPASTIKAN: Login dengan Google agar menggunakan Drive Otomatis (Anti-CORS).`;
          }
          reject(new Error(msg));
        },
        async () => {
          clearTimeout(safetyTimeout);
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  } catch (error: any) {
    console.error('Upload process error:', error);
    throw error;
  }
};

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
  const [karungMaster, setKarungMaster] = useState<KarungMaster[]>([]);
  const [karungMasuk, setKarungMasuk] = useState<KarungMasuk[]>([]);
  const [preFillData, setPreFillData] = useState<Partial<DailyJob> | null>(null);
  const [adminStaffFilter, setAdminStaffFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

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

  // Karung Listeners
  useEffect(() => {
    if (!currentUser) return;

    const unsubKarungMaster = onSnapshot(collection(db, 'karungMaster'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KarungMaster));
      setKarungMaster(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'karungMaster'));

    const qKarungMasuk = query(collection(db, 'karungMasuk'), orderBy('tanggal', 'desc'), limit(100));
    const unsubKarungMasuk = onSnapshot(qKarungMasuk, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KarungMasuk));
      setKarungMasuk(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'karungMasuk'));

    return () => {
      unsubKarungMaster();
      unsubKarungMasuk();
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

  const addKarungMaster = async (name: string) => {
    try {
      const id = `k-${Date.now()}`;
      await setDoc(doc(db, 'karungMaster', id), { id, name });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'karungMaster');
    }
  };

  const deleteKarungMaster = async (id: string) => {
    if (!window.confirm('Hapus jenis karung ini?')) return;
    try {
      await deleteDoc(doc(db, 'karungMaster', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `karungMaster/${id}`);
    }
  };

  const addKarungMasuk = async (karungData: Omit<KarungMasuk, 'id' | 'createdAt'>) => {
    try {
      const id = `km-${Date.now()}`;
      const newEntry: KarungMasuk = {
        id,
        ...karungData,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'karungMasuk', id), newEntry);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'karungMasuk');
    }
  };

  const deleteKarungMasuk = async (id: string) => {
    if (!window.confirm('Hapus laporan karung masuk ini?')) return;
    try {
      await deleteDoc(doc(db, 'karungMasuk', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `karungMasuk/${id}`);
    }
  };

  const exportKarungToExcel = () => {
    const data = karungMasuk.flatMap(report => 
      report.items.map(item => ({
        Tanggal: report.tanggal,
        PIC: report.pic,
        Jenis_Karung: item.name,
        Jumlah: item.jumlah,
        Waktu_Input: new Date(report.createdAt).toLocaleString()
      }))
    );
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Karung Masuk");
    XLSX.writeFile(wb, `Report_Karung_Masuk_${new Date().toISOString().split('T')[0]}.xlsx`);
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
    
    return [...jobs].sort((a, b) => {
      const isAActive = a.waktuSelesai === '-';
      const isBActive = b.waktuSelesai === '-';
      
      if (isAActive && !isBActive) return -1;
      if (!isAActive && isBActive) return 1;
      
      // For jobs with same status, we use date and time if possible
      // Assuming yyyy-mm-dd format for tanggal
      if (a.tanggal !== b.tanggal) {
        return b.tanggal.localeCompare(a.tanggal);
      }
      
      return b.waktuMulai.localeCompare(a.waktuMulai);
    });
  };

  const visibleJobs = getFilteredJobs();

  const resetAllData = async () => {
    if (!currentUser || currentUser.role !== 'Admin') return;
    
    const confirm1 = window.confirm('APAKAH ANDA YAKIN? Semua laporan (Daily Jobs) akan dihapus secara permanen dari database!');
    if (!confirm1) return;
    
    const confirm2 = window.confirm('Peringatan terakhir: Data yang sudah dihapus tidak dapat dikembalikan. Pastikan Anda sudah Export CSV dan Download Foto. Lanjutkan hapus semua?');
    if (!confirm2) return;

    setIsLoading(true);
    try {
      const q = query(collection(db, 'dailyJobs'));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      alert('Semua data laporan berhasil dikosongkan!');
    } catch (error) {
      console.error('Reset failed:', error);
      alert('Gagal menghapus data. Silahkan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

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
              {view === 'KarungMasuk' && 'Pendataan Karung'}
              {view === 'KarungMaster' && 'List Jenis Karung'}
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
                  <MenuCard 
                    onClick={() => handleSetView('KarungMasuk')}
                    icon={<Archive className="text-blue-600" />}
                    label="Karung Masuk"
                    color="bg-blue-50"
                  />
                  {currentUser?.role === 'Admin' && (
                    <>
                      <MenuCard 
                        onClick={() => handleSetView('KarungMaster')}
                        icon={<ClipboardList className="text-purple-600" />}
                        label="List Karung"
                        color="bg-purple-50"
                      />
                      <MenuCard 
                        onClick={() => handleSetView('UserManagement')}
                        icon={<Users className="text-emerald-600" />}
                        label="Staff"
                        color="bg-emerald-50"
                      />
                    </>
                  )}
                </div>

                {isInstallable && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-[2.5rem] bg-emerald-50 text-emerald-900 border border-emerald-100 flex flex-col items-center text-center gap-4 shadow-xl shadow-emerald-50/50"
                  >
                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                      <Download size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-tight">Instal Aplikasi di Mobile</h3>
                      <p className="text-[10px] font-bold text-emerald-700/70 uppercase tracking-widest leading-relaxed">Instal aplikasi ke layar utama <br/> agar akses lebih mudah dan cepat.</p>
                    </div>
                    <button 
                      onClick={handleInstallClick}
                      className="w-full bg-emerald-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                    >
                      Instal Sekarang
                    </button>
                  </motion.div>
                )}

                {!isInstallable && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
                  <div className="p-6 rounded-[2.5rem] bg-indigo-50 border border-indigo-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0">
                      <Download size={18} />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-[11px] font-black uppercase tracking-tight">Instal di iOS</h3>
                      <p className="text-[9px] font-bold text-indigo-700/60 uppercase tracking-wider leading-relaxed">
                        Klik ikon <span className="bg-indigo-100 px-1 rounded">Share</span> lalu <br/> pilih <span className="bg-indigo-100 px-1 rounded">Add to Home Screen</span>
                      </p>
                    </div>
                  </div>
                )}
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

                        {/* Foto Mulai (Always visible if exists) */}
                        {job.fotoMulai && (
                          <div className="mb-4">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Foto Mulai</p>
                            <div 
                              className="rounded-2xl overflow-hidden border border-slate-100 cursor-pointer group relative"
                              onClick={() => setPreviewImage(job.fotoMulai!)}
                            >
                              <img 
                                src={job.fotoMulai} 
                                alt="Foto Mulai" 
                                className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="bg-slate-900/20 opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center transition-opacity text-white text-[9px] font-black uppercase">
                                 Lihat Foto Mulai
                              </div>
                            </div>
                          </div>
                        )}

                        {job.waktuSelesai === '-' ? (
                          <div className="py-6 border-t border-slate-50 mb-4 text-center">
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

                            {/* Foto Selesai */}
                            {job.fotoSelesai && (
                              <div className="mb-4">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Foto Selesai</p>
                                <div 
                                  className="rounded-2xl overflow-hidden border border-slate-100 cursor-pointer group relative"
                                  onClick={() => setPreviewImage(job.fotoSelesai!)}
                                >
                                  <img 
                                    src={job.fotoSelesai} 
                                    alt="Foto Selesai" 
                                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="bg-slate-900/40 opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center transition-opacity text-white font-bold text-[10px] uppercase">
                                     Lihat Foto Selesai
                                  </div>
                                </div>
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
                setPreviewImage={setPreviewImage}
                users={users}
                onResetData={resetAllData}
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

          {view === 'KarungMasuk' && (
            <motion.div
              key="karung-masuk"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <KarungMasukView 
                karungMaster={karungMaster}
                karungMasuk={karungMasuk}
                onSubmit={addKarungMasuk}
                onDelete={deleteKarungMasuk}
                currentUser={currentUser!}
                onExport={exportKarungToExcel}
              />
            </motion.div>
          )}

          {view === 'KarungMaster' && currentUser?.role === 'Admin' && (
            <motion.div
              key="karung-master"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <KarungMasterView 
                karungMaster={karungMaster}
                onAdd={addKarungMaster}
                onDelete={deleteKarungMaster}
              />
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
        {previewImage && (
          <div 
             className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col p-6"
             onClick={() => setPreviewImage(null)}
          >
            <div className="flex justify-end p-2">
               <button className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all">
                  <Plus className="rotate-45" size={24} />
               </button>
            </div>
            <div className="flex-1 flex items-center justify-center">
               <motion.img 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={previewImage} 
                  className="max-w-full max-h-full rounded-2xl shadow-2xl" 
                  alt="Preview"
                  onClick={(e) => e.stopPropagation()}
                  referrerPolicy="no-referrer"
               />
            </div>
            <div className="mt-8 text-center text-white/40 text-[10px] font-bold uppercase tracking-widest">
               Sentuh dimana saja untuk kembali
            </div>
          </div>
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
    <div className="min-h-screen bg-slate-950 font-sans text-white max-w-md mx-auto flex flex-col p-8 overflow-hidden relative">
      {/* Decorative Blur */}
      <div className="absolute top-0 -left-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 -right-20 w-64 h-64 bg-emerald-600/20 rounded-full blur-[100px]" />

      <div className="flex-1 flex flex-col justify-center max-w-xs mx-auto w-full gap-12 relative z-10">
        <div className="text-center space-y-6">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-white rounded-[2.5rem] mx-auto flex items-center justify-center text-slate-950 shadow-2xl shadow-indigo-500/20 rotate-6 border-b-8 border-slate-200"
          >
            <Lock size={42} />
          </motion.div>
          
          <div className="space-y-2">
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-4xl font-black tracking-tighter uppercase"
            >
              MAMADOLLAY <br/> <span className="text-indigo-400">APPS</span>
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[10px] font-black uppercase text-slate-500 tracking-[0.5em]"
            >
              Management System
            </motion.p>
          </div>
        </div>

        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center space-y-4"
          >
            <p className="text-sm font-bold text-slate-300">Hubungkan Akun Kerja</p>
            <p className="text-[11px] font-medium text-slate-500 px-6 leading-relaxed">
              Login untuk mengelola laporan operasional housekeeping secara digital.
            </p>
          </motion.div>

          <motion.button 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white text-slate-950 font-black py-4 rounded-3xl shadow-xl shadow-indigo-500/10 transition-all hover:scale-105 active:scale-95 text-xs uppercase flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            {isLoggingIn ? 'Otentikasi...' : 'Masuk dengan Google'}
          </motion.button>

          <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
             <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed text-center">
               Aplikasi ini akan menyimpan data foto secara otomatis ke folder Google Drive Anda.
             </p>
          </div>
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-[9px] font-black text-slate-800 uppercase tracking-widest mt-8"
        >
          v2.0 • MAMADOLLAY MULTISERVICES
        </motion.p>
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
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

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
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
    setUploadStatus('Memulai...');
    try {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const startTime = `${hours}:${minutes}`;

      const photoUrl = selectedFile ? await uploadAndCompressImage(selectedFile, (phase, p) => {
        setUploadStatus(`${phase} (${p}%)`);
      }) : '';

      const job: DailyJob = {
        id: Math.random().toString(36).substr(2, 9),
        tanggal: formData.tanggal!,
        pic: formData.pic!,
        lokasi: formData.lokasi!,
        shift: formData.shift as Shift,
        kegiatan: formData.kegiatan!,
        waktuMulai: startTime,
        waktuSelesai: '-',
        foto: photoUrl,
        fotoMulai: photoUrl,
        keterangan: '',
        durasi: '-',
      };
      
      await onSubmit(job);
      setIsSubmitting(false);
      setUploadStatus('');
      setShowSuccess(true);
      setTimeout(() => {
        onCancel();
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Gagal menyimpan laporan: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
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
                <span>{uploadStatus}</span>
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [keterangan, setKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

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

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return alert('Bukti foto wajib dilampirkan!');
    setIsSubmitting(true);
    setUploadStatus('Memulai...');
    try {
      const endTime = getCurrentTime();
      // Compress and upload to storage with progress callback
      const photoUrl = await uploadAndCompressImage(selectedFile, (phase, p) => {
        setUploadStatus(`${phase} (${p}%)`);
      });
      
      const updates = {
        waktuSelesai: endTime,
        foto: photoUrl,
        fotoSelesai: photoUrl,
        keterangan: keterangan,
        durasi: calculateDuration(job.waktuMulai, endTime)
      };
      await onFinish(updates);
    } catch (error) {
      console.error('Submit error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Gagal menyelesaikan laporan: ${errorMessage}. Pastikan koneksi internet stabil.`);
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
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

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {job.foto && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Foto Awal (Mulai)</label>
              <div className="w-full h-32 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                <img src={job.foto} alt="Foto Awal" className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Foto Bukti Selesai (Wajib)</label>
            <input 
              type="file" accept="image/*" capture="environment" 
              className="hidden" ref={fileInputRef} onChange={handleImageCapture}
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[160px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-indigo-50/30 hover:border-indigo-200 transition-all overflow-hidden"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Bukti Selesai" className="w-full h-full object-cover max-h-64" />
              ) : (
                <>
                  <div className="p-4 bg-white rounded-full shadow-sm text-indigo-400">
                    <ImageIcon size={24} />
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center px-4">Ambil Foto Hasil Kerja <br/> (Selesai)</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2 pb-4">
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
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{uploadStatus}</span>
            </>
          ) : 'Konfirmasi Selesai'}
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
  setPreviewImage,
  users,
  onResetData
}: { 
  dailyJobs: DailyJob[], 
  currentUser: UserAccount,
  staffFilter: string,
  setStaffFilter: (s: string) => void,
  setPreviewImage: (s: string | null) => void,
  users: UserAccount[],
  onResetData: () => Promise<void>
}) {
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const exportPhotosToZip = async () => {
    const jobsWithPhotos = dailyJobs.filter(j => j.foto && j.foto.startsWith('http'));
    if (jobsWithPhotos.length === 0) return alert('Tidak ada foto untuk di-backup');

    setIsZipping(true);
    setZipProgress(0);
    const zip = new JSZip();
    const photoFolder = zip.folder("daily_photos");

    try {
      for (let i = 0; i < jobsWithPhotos.length; i++) {
        const job = jobsWithPhotos[i];
        setZipProgress(Math.round(((i + 1) / jobsWithPhotos.length) * 100));
        
        try {
          const response = await fetch(job.foto);
          const blob = await response.blob();
          const fileName = `${job.tanggal}_${job.pic.replace(/\s+/g, '_')}_${job.id}.jpg`;
          photoFolder?.file(fileName, blob);
        } catch (e) {
          console.error(`Gagal mengunduh foto: ${job.id}`, e);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `backup_foto_${new Date().toISOString().split('T')[0]}.zip`);
    } catch (error) {
      console.error('ZIP creation failed:', error);
      alert('Gagal membuat file ZIP');
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  };

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

      {currentUser.role === 'Admin' && (
        <div className="space-y-3">
          <button 
            onClick={exportToCSV}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-[2rem] transition-all hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-3 uppercase text-xs shadow-xl shadow-slate-100"
          >
            <Download size={18} />
            Ekspor Data CSV (Excel)
          </button>

          <button 
            onClick={exportPhotosToZip}
            disabled={isZipping}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-[2rem] transition-all hover:bg-indigo-700 active:scale-[0.98] flex items-center justify-center gap-3 uppercase text-xs shadow-xl shadow-indigo-100 disabled:opacity-70"
          >
            {isZipping ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Mengemas Foto ({zipProgress}%)
              </>
            ) : (
              <>
                <ImageIcon size={18} />
                Backup Semua Foto (ZIP)
              </>
            )}
          </button>

          <button 
            onClick={onResetData}
            className="w-full bg-white border border-red-100 text-red-500 font-bold py-4 rounded-[2rem] transition-all hover:bg-red-50 active:scale-[0.98] flex items-center justify-center gap-3 uppercase text-xs shadow-lg shadow-red-50/50"
          >
            <Trash2 size={18} />
            Kosongkan Database (Reset)
          </button>
        </div>
      )}

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
                    <th className="px-5 py-4 text-[9px] font-extrabold uppercase text-slate-400 tracking-widest">Tugas</th>
                    <th className="px-5 py-4 text-[9px] font-extrabold uppercase text-slate-400 tracking-widest">Awal</th>
                    <th className="px-5 py-4 text-[9px] font-extrabold uppercase text-slate-400 tracking-widest">Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dailyJobs.slice(0, 20).map(job => (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 text-[10px] font-bold text-slate-600">{job.tanggal.split('-').slice(1).reverse().join('/')}</td>
                      <td className="px-5 py-4 text-[10px] font-bold text-slate-900">{job.pic}</td>
                      <td className="px-5 py-4 text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{job.kegiatan}</td>
                      <td className="px-5 py-4">
                        {job.fotoMulai ? (
                          <button 
                            onClick={() => setPreviewImage(job.fotoMulai!)}
                            className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:scale-110 transition-transform inline-block group relative"
                          >
                             <img src={job.fotoMulai} alt="Awal" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Search size={10} className="text-white" />
                             </div>
                          </button>
                        ) : <span className="text-slate-200">-</span>}
                      </td>
                      <td className="px-5 py-4">
                        {job.fotoSelesai ? (
                          <div className="flex items-center gap-2">
                             <button 
                               onClick={() => setPreviewImage(job.fotoSelesai!)}
                               className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:scale-110 transition-transform inline-block group relative"
                             >
                                <img src={job.fotoSelesai} alt="Akhir" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                   <Search size={10} className="text-white" />
                                </div>
                             </button>
                          </div>
                        ) : (
                          <span className="text-slate-200">-</span>
                        )}
                      </td>
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

function KarungMasterView({ 
  karungMaster, 
  onAdd, 
  onDelete 
}: { 
  karungMaster: KarungMaster[], 
  onAdd: (name: string) => Promise<void>, 
  onDelete: (id: string) => Promise<void> 
}) {
  const [newName, setNewName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName('');
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2.5rem] border border-indigo-100 shadow-xl shadow-indigo-50/50 space-y-4">
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Karung Baru</label>
          <input 
            type="text" 
            placeholder="Contoh: Karung Plastik 50kg"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] font-bold uppercase focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          />
        </div>
        <button 
          type="submit"
          className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase shadow-lg shadow-indigo-100"
        >
          Tambah Jenis Karung
        </button>
      </form>

      <div className="space-y-4">
        <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">List Karung</h3>
        <div className="grid grid-cols-1 gap-3">
          {karungMaster.map(k => (
            <div key={k.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-700">{k.name}</span>
              <button 
                onClick={() => onDelete(k.id)}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {karungMaster.length === 0 && <p className="text-center text-[10px] text-slate-400 font-bold uppercase p-8 bg-white rounded-2xl border border-dashed border-slate-200">Belum ada data</p>}
        </div>
      </div>
    </div>
  );
}

function KarungMasukView({ 
  karungMaster, 
  karungMasuk, 
  onSubmit, 
  onDelete,
  currentUser,
  onExport
}: { 
  karungMaster: KarungMaster[], 
  karungMasuk: KarungMasuk[], 
  onSubmit: (data: Omit<KarungMasuk, 'id' | 'createdAt'>) => Promise<void>, 
  onDelete: (id: string) => Promise<void>,
  currentUser: UserAccount,
  onExport: () => void
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<KarungMasukItem[]>([]);
  
  const [currentKarungId, setCurrentKarungId] = useState('');
  const [currentJumlah, setCurrentJumlah] = useState('');

  const addItem = () => {
    if (!currentKarungId || !currentJumlah) return;
    const karung = karungMaster.find(k => k.id === currentKarungId);
    if (!karung) return;

    setItems([...items, { karungId: karung.id, name: karung.name, jumlah: Number(currentJumlah) }]);
    setCurrentKarungId('');
    setCurrentJumlah('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return alert('Tambahkan setidaknya satu item');
    
    await onSubmit({
      tanggal,
      pic: currentUser.name,
      items
    });

    setIsAdding(false);
    setItems([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-900">Karung Masuk</h2>
        <div className="flex gap-2">
          <button 
            onClick={onExport}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-100 uppercase"
          >
            <Download size={16} />
            Excel
          </button>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95 shadow-lg shadow-indigo-100 uppercase ${
              isAdding ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isAdding ? 'Batal' : <><Plus size={16} /> Tambah</>}
          </button>
        </div>
      </div>

      {isAdding && (
        <motion.form 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleFormSubmit}
          className="bg-white p-6 rounded-[2.5rem] border border-indigo-100 shadow-xl shadow-indigo-50/50 space-y-4 border-2"
        >
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
            <input 
              type="date" 
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Input Item Karung</p>
            <div className="grid grid-cols-1 gap-3">
              <select 
                value={currentKarungId}
                onChange={e => setCurrentKarungId(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-xl p-3 text-[10px] font-bold uppercase focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              >
                <option value="">Pilih Jenis Karung</option>
                {karungMaster.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Jumlah"
                  value={currentJumlah}
                  onChange={e => setCurrentJumlah(e.target.value)}
                  className="flex-1 bg-white border border-slate-100 rounded-xl p-3 text-[10px] font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
                <button 
                  type="button"
                  onClick={addItem}
                  className="bg-slate-900 text-white px-6 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all"
                >
                  Tambah
                </button>
              </div>
            </div>

            {items.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Daftar Input:</p>
                {items.map((item, idx) => (
                  <div key={idx} className="bg-white px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-slate-900 uppercase">{item.name}</span>
                      <span className="text-[10px] text-indigo-600 font-bold ml-2">x {item.jumlah}</span>
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-400 p-1 hover:bg-red-50 rounded-lg">
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase shadow-lg shadow-indigo-100 active:scale-95 transition-all"
          >
            Simpan Laporan Karung
          </button>
        </motion.form>
      )}

      <div className="space-y-4">
        <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Histori Karung Masuk</h3>
        <div className="space-y-4">
          {karungMasuk.map(report => (
            <div key={report.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{report.tanggal}</span>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">PIC: {report.pic}</h4>
                    </div>
                    {currentUser.role === 'Admin' && (
                      <button onClick={() => onDelete(report.id)} className="text-slate-200 hover:text-red-500 p-2 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-50">
                    {report.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">{item.name}</span>
                        <span className="text-[11px] font-black text-slate-900">{item.jumlah} Pcs</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          ))}
          {karungMasuk.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-[10px] font-extrabold uppercase tracking-widest bg-white border border-dashed border-slate-200 rounded-[2.5rem]">
              Belum ada data laporan
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
