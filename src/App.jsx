import { useState, useEffect, useRef } from 'react';
import { storage } from './services/storage';
import { syncService } from './services/sync';
import './App.css';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [localData, setLocalData] = useState([]);
  const [serverData, setServerData] = useState([]);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('local');
  
  // Usar ref para evitar sincronizaciones múltiples simultáneas
  const syncInProgress = useRef(false);
  const autoSyncEnabled = useRef(true);

  // Función para sincronizar automáticamente
  const autoSync = async () => {
    // Evitar sincronización si ya hay una en progreso
    if (syncInProgress.current || !autoSyncEnabled.current) return;
    
    // Verificar si hay datos pendientes
    const pending = await storage.getPendingData();
    const unsynced = pending.filter(item => !item.synced);
    
    if (unsynced.length === 0) return;
    
    syncInProgress.current = true;
    
    try {
      console.log('🔄 Sincronización automática iniciada...');
      const result = await syncService.syncPendingData();
      
      if (result.synced > 0) {
        await storage.clearSynced();
        loadLocalData();
        loadServerData();
        setMessage(`✓ Auto-sync: ${result.synced} datos sincronizados`);
        setTimeout(() => setMessage(''), 4000);
      }
    } catch (error) {
      console.error('Error en auto-sync:', error);
    } finally {
      syncInProgress.current = false;
    }
  };

  // Monitorear cambios de conexión
  useEffect(() => {
    const handleOnline = async () => {
      console.log('🟢 Conexión restaurada');
      setIsOnline(true);
      setMessage('🟢 Conexión restaurada - sincronizando...');
      
      // Esperar un momento para que la conexión se estabilice
      setTimeout(async () => {
        await autoSync();
        await loadServerData();
      }, 1000);
    };
    
    const handleOffline = () => {
      console.log('🔴 Conexión perdida');
      setIsOnline(false);
      setMessage('🔴 Sin conexión - trabajando offline');
      setTimeout(() => setMessage(''), 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar datos al iniciar y sincronizar si hay pendientes
  useEffect(() => {
    const initializeApp = async () => {
      await loadLocalData();
      
      if (isOnline) {
        await loadServerData();
        // Sincronizar automáticamente al abrir si hay datos pendientes
        setTimeout(autoSync, 500);
      }
    };
    
    initializeApp();
  }, []);

  // Actualizar cuando cambia el estado online
  useEffect(() => {
    if (isOnline) {
      loadServerData();
    }
  }, [isOnline]);

  const loadLocalData = async () => {
    const pending = await storage.getPendingData();
    setLocalData(pending);
    const unsynced = pending.filter(item => !item.synced);
    setPendingCount(unsynced.length);
  };

  const loadServerData = async () => {
    if (!isOnline) return;
    
    setLoading(true);
    try {
      const data = await syncService.fetchServerData();
      setServerData(data);
    } catch (error) {
      console.error('Error cargando datos del servidor:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await storage.addPendingData(formData);
      setMessage('✓ Datos guardados localmente');
      setFormData({ nombre: '', descripcion: '' });
      await loadLocalData();
      
      // Si está online, intentar sincronizar automáticamente
      if (isOnline) {
        setTimeout(() => {
          autoSync();
        }, 500);
      }
      
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
        loadLocalData();
        await loadServerData();
      }
      
      if (result.failed > 0) {
        setMessage(prev => prev + ` | ✗ Fallidos: ${result.failed}`);
      }
    } catch (error) {
      setMessage('✗ Error: ' + error.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleRefreshServer = async () => {
    await loadServerData();
    setMessage('✓ Datos actualizados');
    setTimeout(() => setMessage(''), 2000);
  };

  return (
    <div className="App">
      <header>
        <h1>Mi PWA con Sincronización</h1>
        <div className="status">
          Estado: <span className={isOnline ? 'online' : 'offline'}>
            {isOnline ? '🟢 Conectado' : '🔴 Sin conexión'}
          </span>
          {pendingCount > 0 && isOnline && (
            <span className="auto-sync-indicator">
              • Auto-sync activo
            </span>
          )}
        </div>
      </header>

      <main>
        {/* Formulario para agregar datos */}
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

        {/* Sección de sincronización */}
        <div className="sync-section">
          <p>Datos pendientes: <strong>{pendingCount}</strong></p>
          <button 
            onClick={handleSync} 
            disabled={!isOnline || syncing || pendingCount === 0}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora (Manual)'}
          </button>
          <p className="sync-info">
            {isOnline && pendingCount > 0 
              ? '💡 La sincronización automática está activa'
              : isOnline 
                ? '✓ No hay datos pendientes'
                : '⚠️ Sincronizará automáticamente al reconectar'}
          </p>
        </div>

        {/* Tabs para alternar entre vistas */}
        <div className="tabs">
          <button 
            className={activeTab === 'local' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('local')}
          >
            Datos Locales ({localData.length})
          </button>
          <button 
            className={activeTab === 'server' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('server')}
            disabled={!isOnline}
          >
            Datos del Servidor ({serverData.length})
          </button>
        </div>

        {/* Contenido de las tabs */}
        {activeTab === 'local' && (
          <div className="data-list">
            <h2>Datos Almacenados Localmente</h2>
            {localData.length === 0 ? (
              <p className="empty-state">No hay datos locales. Agrega algunos usando el formulario.</p>
            ) : (
              localData.map((item) => (
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
              ))
            )}
          </div>
        )}

        {activeTab === 'server' && (
          <div className="data-list">
            <div className="server-header">
              <h2>Datos en Supabase</h2>
              <button 
                onClick={handleRefreshServer} 
                disabled={loading || !isOnline}
                className="refresh-btn"
              >
                {loading ? '⟳ Cargando...' : '↻ Actualizar'}
              </button>
            </div>
            
            {loading ? (
              <p className="loading-state">Cargando datos...</p>
            ) : !isOnline ? (
              <p className="empty-state">Sin conexión. Conéctate para ver los datos del servidor.</p>
            ) : serverData.length === 0 ? (
              <p className="empty-state">No hay datos en el servidor. Sincroniza algunos datos locales.</p>
            ) : (
              serverData.map((item) => (
                <div key={item.id} className="data-item server">
                  <h3>{item.nombre}</h3>
                  <p>{item.descripcion}</p>
                  <div className="meta">
                    <span>
                      Creado: {new Date(item.created_at).toLocaleString('es-CL')}
                    </span>
                    <span className="badge server">
                      ID: {item.id}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;