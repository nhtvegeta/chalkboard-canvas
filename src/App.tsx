import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Engine } from './engine/Engine';
import { useEngine } from './hooks/useEngine';
import { Toolbar } from './components/Toolbar';
import { TopBar } from './components/TopBar';
import { BookmarksSidebar } from './components/BookmarksSidebar';
import { RegionDialog } from './components/RegionDialog';
import { TextEditor } from './components/TextEditor';
import { SaveDialog } from './components/SaveDialog';
import { BOARD_COLORS } from './engine/constants';
import { I18nProvider } from './i18n/I18nContext';

export const AppContent: React.FC = () => {
  const engine = useMemo(() => new Engine(), []);
  useEngine(engine);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    engine.onToast = (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3200);
    };

    if (containerRef.current && gridCanvasRef.current && canvasRef.current) {
      engine.mount(containerRef.current, gridCanvasRef.current, canvasRef.current);
      engine.load();
    }

    if (document.fonts) {
      document.fonts.ready.then(() => {
        engine.invalidate();
      });
    }

    return () => {
      engine.unmount();
    };
  }, [engine]);

  useEffect(() => {
    engine.setInsetRight(sidebarOpen ? 320 : 0);
  }, [engine, sidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space') {
        engine.setSpace(true);
      }

      // Ctrl + S: Shortcut for Save file modal
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSaveModalOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        engine.undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        engine.redo();
      } else if (e.key === 'Escape') {
        engine.escape();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        engine.deleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        engine.selectAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        engine.duplicateSelected();
      } else {
        switch (e.key.toLowerCase()) {
          case 'v':
            engine.setTool('select');
            break;
          case 'h':
            engine.setTool('hand');
            break;
          case 'p':
            engine.setTool('chalk');
            break;
          case 'd':
            engine.setTool('highlighter');
            break;
          case 'e':
            engine.setTool('eraser');
            break;
          case 't':
            engine.setTool('text');
            break;
          case 's':
            engine.setTool('sticky');
            break;
          case 'r':
            engine.setTool('rect');
            break;
          case 'o':
            engine.setTool('ellipse');
            break;
          case 'a':
            engine.setTool('arrow');
            break;
          case 'l':
            engine.setTool('line');
            break;
          case 'b':
            engine.setTool('region');
            break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        engine.setSpace(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [engine]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const rect = containerRef.current?.getBoundingClientRect();
      const screenPt = rect
        ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
        : undefined;
      engine.addImageFile(file, screenPt);
    }
  };

  const boardBg = BOARD_COLORS[engine.settings.board] || '#18221e';

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative w-screen h-screen overflow-hidden select-none font-sans"
      style={{ backgroundColor: boardBg }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 80%),
                            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '100% 100%, 20px 20px',
        }}
      />

      <canvas
        ref={gridCanvasRef}
        className="absolute inset-0 pointer-events-none w-full h-full"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
      />

      <TextEditor engine={engine} />
      <RegionDialog engine={engine} />

      <TopBar
        engine={engine}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenSaveModal={() => setSaveModalOpen(true)}
      />

      <Toolbar engine={engine} />

      <BookmarksSidebar
        engine={engine}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Save File Modal */}
      <SaveDialog
        engine={engine}
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
      />

      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1e2622]/95 border border-[#3b473f] text-[#f7e58f] text-xs font-semibold px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
};

export default App;
