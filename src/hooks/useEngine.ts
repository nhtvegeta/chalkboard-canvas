import { useEffect, useState } from 'react';
import type { Engine } from '../engine/Engine';

export function useEngine(engine: Engine): number {
  const [version, setVersion] = useState(() => engine.getVersion());

  useEffect(() => {
    return engine.subscribe(() => {
      setVersion(engine.getVersion());
    });
  }, [engine]);

  return version;
}
