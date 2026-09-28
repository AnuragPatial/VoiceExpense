import React from 'react';

export const StatusIndicator = ({ status }) => {
  if (status === 'listening' || status === 'speaking') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-400">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span>{status === 'speaking' ? 'Assistant Speaking' : 'Listening'}</span>
      </div>
    );
  }

  if (status === 'connected' || status === 'connecting') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-400">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <span>{status === 'connecting' ? 'Connecting...' : 'Connected'}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400">
      <span className="inline-block h-2 w-2 rounded-full border border-neutral-600 bg-neutral-800"></span>
      <span>Disconnected</span>
    </div>
  );
};

export default StatusIndicator;
