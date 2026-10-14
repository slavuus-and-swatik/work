'use client';
import { useEffect, useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PWAInstallButton({ className = '' }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [isIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  });
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (isInstalled) {
    return null;
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      setShowIOSModal(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`pwa-install-pill ${className}`}
        title="Добавить на главный экран телефона как мобильное приложение"
      >
        <Smartphone size={14} />
        <span>На экран «Домой»</span>
      </button>

      {/* iOS / Generic Home Screen Guide Modal */}
      {showIOSModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowIOSModal(false)}
        >
          <div
            style={{
              background: '#121620',
              border: '1px solid #26334d',
              borderRadius: '20px',
              maxWidth: '380px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#2563eb', display: 'grid', placeItems: 'center' }}>
                  <Smartphone size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Добавить на экран</h3>
                  <small style={{ color: '#8e9bb5' }}>Быстрый доступ как приложение</small>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                style={{ background: 'none', border: 0, color: '#8e9bb5', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', lineHeight: 1.5, color: '#cbd5e1' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#182030', padding: '12px', borderRadius: '12px' }}>
                <div style={{ background: '#2563eb', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>
                  1
                </div>
                <div>
                  В браузере Safari или Chrome нажмите кнопку меню <strong>«Поделиться»</strong> <Share2 size={13} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} /> (или три точки ⋮).
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#182030', padding: '12px', borderRadius: '12px' }}>
                <div style={{ background: '#2563eb', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>
                  2
                </div>
                <div>
                  Прокрутите список вниз и выберите пункт <strong>«На экран «Домой»</strong> (<Download size={13} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} />).
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#182030', padding: '12px', borderRadius: '12px' }}>
                <div style={{ background: '#10b981', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>
                  ✓
                </div>
                <div>
                  Нажмите <strong>«Добавить»</strong>. Сайт появится как отдельная иконка приложения и будет открываться на весь экран без адресной строки!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              style={{
                marginTop: '20px',
                width: '100%',
                height: '42px',
                background: '#2563eb',
                color: '#fff',
                border: 0,
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}
