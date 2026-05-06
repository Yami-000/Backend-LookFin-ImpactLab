import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, isAbsolute, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar las credenciales de Firebase desde una variable de entorno o desde archivo local
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const serviceAccountPathFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountJson && !serviceAccountPathFromEnv) {
    throw new Error('Debe definir FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH en el archivo .env');
}

const serviceAccountPath = serviceAccountPathFromEnv
    ? (isAbsolute(serviceAccountPathFromEnv)
        ? serviceAccountPathFromEnv
        : join(__dirname, '..', '..', serviceAccountPathFromEnv))
    : null;

const serviceAccount = serviceAccountJson
    ? JSON.parse(serviceAccountJson)
    : JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Inicializar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`,
});

// Obtener referencia a Firestore
export const db = admin.firestore();

console.log('Firebase Admin inicializado correctamente');

export default admin;
