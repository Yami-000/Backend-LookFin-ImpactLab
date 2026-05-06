import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, isAbsolute, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const serviceAccountPathFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

const buildAdminOptions = () => {
    if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);

        return {
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`,
        };
    }

    if (serviceAccountPathFromEnv) {
        const serviceAccountPath = isAbsolute(serviceAccountPathFromEnv)
            ? serviceAccountPathFromEnv
            : join(__dirname, '..', '..', serviceAccountPathFromEnv);
        if (!existsSync(serviceAccountPath)) {
            console.warn(`No se encontró el service account en ${serviceAccountPath}. Firebase Auth quedará inactivo hasta configurar una credencial válida.`);
            return {
                credential: admin.credential.applicationDefault(),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            };
        }
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

        return {
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`,
        };
    }

    return {
        credential: admin.credential.applicationDefault(),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    };
};

if (!admin.apps.length) {
    admin.initializeApp(buildAdminOptions());
}

// Obtener referencia a Firestore
export const db = admin.firestore();

console.log('Firebase Admin inicializado correctamente');

export default admin;
