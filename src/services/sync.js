import { storage } from './storage';

// Detectar automáticamente la URL del API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

console.log('API URL configurada:', API_URL);

export const syncService = {
  // Verificar si hay conexión
  isOnline() {
    return navigator.onLine;
  },

  // Sincronizar datos pendientes
  async syncPendingData() {
    if (!this.isOnline()) {
      throw new Error('No hay conexión a internet');
    }

    const pendingData = await storage.getPendingData();
    const unsynced = pendingData.filter(item => !item.synced);

    if (unsynced.length === 0) {
      return { success: true, synced: 0 };
    }

    const results = [];
    const errors = [];
    
    for (const item of unsynced) {
      try {
        console.log('Sincronizando:', item);
        const response = await fetch(`${API_URL}/datos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item)
        });

        if (response.ok) {
          results.push(item.id);
          console.log('✓ Sincronizado:', item.id);
        } else {
          const error = await response.json();
          console.error('Error en respuesta:', error);
          errors.push(item.id);
        }
      } catch (error) {
        console.error('Error sincronizando item:', error);
        errors.push(item.id);
      }
    }

    // Marcar como sincronizados
    if (results.length > 0) {
      await storage.markAsSynced(results);
    }

    return {
      success: true,
      synced: results.length,
      failed: errors.length
    };
  }
};