import localforage from 'localforage';

// Configurar localforage
const dataStore = localforage.createInstance({
  name: 'miAppDB',
  storeName: 'datos_pendientes'
});

export const storage = {
  // Agregar datos pendientes de sincronizar
  async addPendingData(data) {
    const pendingData = await this.getPendingData();
    const newData = {
      id: Date.now(), // ID temporal
      ...data,
      timestamp: new Date().toISOString(),
      synced: false
    };
    pendingData.push(newData);
    await dataStore.setItem('pending', pendingData);
    return newData;
  },

  // Obtener todos los datos pendientes
  async getPendingData() {
    const data = await dataStore.getItem('pending');
    return data || [];
  },

  // Marcar datos como sincronizados
  async markAsSynced(ids) {
    const pendingData = await this.getPendingData();
    const updated = pendingData.map(item => 
      ids.includes(item.id) ? { ...item, synced: true } : item
    );
    await dataStore.setItem('pending', updated);
  },

  // Limpiar datos sincronizados
  async clearSynced() {
    const pendingData = await this.getPendingData();
    const stillPending = pendingData.filter(item => !item.synced);
    await dataStore.setItem('pending', stillPending);
  }
};