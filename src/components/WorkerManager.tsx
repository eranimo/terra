import React, { useEffect } from 'react';
import { WorldgenClient } from '../worldgen/WorldgenClient';


export const WorkerContext = React.createContext<WorldgenClient>(null);

export const WorkerManager = ({ children }) => {
  const client = new WorldgenClient();

  return (
    <WorkerContext.Provider value={client}>
      {children}
    </WorkerContext.Provider>
  )
}