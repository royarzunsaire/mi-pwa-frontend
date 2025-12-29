import { useState, useEffect } from 'react';
import { storage } from './services/storage';
import { syncService } from './services/sync';
import './App.css';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [dataList, setDataList] = useState([]);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  // Monitorear conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar datos al iniciar
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const pending = await storage.getPendingData();
    setDataList(pending);
    const unsynced = pending.filter(item => !item.synced);
    setPendingCount(unsynced.length);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await storage.addPendingData(formData);
      setMessage('✓ Datos guardados localmente');
      setFormData({ nombre: '', descripcion: '' });
      loadData();
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('✗ Error al guardar: ' + error.message);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage('');
    
    try {
      const result = await syncService.syncPendingData();
      setMessage(`✓ Sincronizados: ${result.synced} registros`);
      
      if (result.synced > 0) {
        await storage.clearSynced();
      }
      
      loadData();
    } catch (error) {
      setMessage('✗ Error: ' + error.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <div className="App">
      <header>
        <h1>Mi PWA con Sincronización</h1>
        <div className="status">
          Estado: <span className={isOnline ? 'online' : 'offline'}>
            {isOnline ? '🟢 Conectado' : '🔴 Sin conexión'}
          </span>
        </div>
      </header>

      <main>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({...formData, nombre: e.target.value})}
            required
          />
          <textarea
            placeholder="Descripción"
            value={formData.descripcion}
            onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
            required
          />
          <button type="submit">Guardar (Local)</button>
        </form>

        {message && <div className="message">{message}</div>}

        <div className="sync-section">
          <p>Datos pendientes: <strong>{pendingCount}</strong></p>
          <button 
            onClick={handleSync} 
            disabled={!isOnline || syncing || pendingCount === 0}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar con servidor'}
          </button>
        </div>

        {dataList.length > 0 && (
          <div className="data-list">
            <h2>Datos almacenados ({dataList.length})</h2>
            {dataList.map((item) => (
              <div key={item.id} className={`data-item ${item.synced ? 'synced' : 'pending'}`}>
                <h3>{item.nombre}</h3>
                <p>{item.descripcion}</p>
                <div className="meta">
                  <span>{new Date(item.timestamp).toLocaleString('es-CL')}</span>
                  <span className={`badge ${item.synced ? 'synced' : 'pending'}`}>
                    {item.synced ? 'Sincronizado' : 'Pendiente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;