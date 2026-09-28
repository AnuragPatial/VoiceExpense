import React, { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import { Mic, MicOff, AlertCircle, Volume2, Sparkles, Settings, RefreshCw } from 'lucide-react';
import StatusIndicator from './StatusIndicator';
import { ConnectionStatus, TranscriptItem } from '../types';

interface VoiceAssistantProps {
  onExpenseMutated: () => void;
  onOpenSettings: () => void;
  vapiConfig: {
    publicKey: string;
    assistantId: string;
  };
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  onExpenseMutated,
  onOpenSettings,
  vapiConfig
}) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [activeSpeechRole, setActiveSpeechRole] = useState<'user' | 'assistant' | null>(null);

  const vapiRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript container to latest message
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        try {
          vapiRef.current.stop();
        } catch (err) {
          // ignore cleanup error
        }
      }
    };
  }, []);

  const getVapiInstance = () => {
    const key = vapiConfig.publicKey || (import.meta as any).env.VITE_VAPI_PUBLIC_KEY || '';
    if (!key) return null;

    if (!vapiRef.current) {
      const vapi = new Vapi(key);

      vapi.on('call-start', () => {
        setStatus('connected');
        setErrorMessage(null);
      });

      vapi.on('call-end', () => {
        setStatus('disconnected');
        setActiveSpeechRole(null);
        setVolumeLevel(0);
        // Refresh expenses when call ends in case expenses were added
        onExpenseMutated();
      });

      vapi.on('speech-start', () => {
        setStatus('listening');
      });

      vapi.on('speech-end', () => {
        setStatus('connected');
        setActiveSpeechRole(null);
      });

      vapi.on('volume-level', (vol: number) => {
        setVolumeLevel(vol);
      });

      vapi.on('message', (message: any) => {
        // Handle real-time transcripts
        if (message.type === 'transcript') {
          const role = message.role === 'user' ? 'user' : 'assistant';
          const text = message.transcript || message.text || '';
          
          if (text.trim()) {
            setActiveSpeechRole(role);
            setTranscripts((prev) => {
              // If last message was same role and not final, update it
              const last = prev[prev.length - 1];
              if (last && last.role === role && !last.isFinal && message.transcriptType === 'partial') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
                ];
              }
              // If final, replace or append
              if (last && last.role === role && !last.isFinal) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text, isFinal: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
                ];
              }
              return [
                ...prev,
                {
                  id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                  role,
                  text,
                  isFinal: message.transcriptType === 'final',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ];
            });
          }
        }

        // Handle tool calls or function execution events
        if (
          message.type === 'tool-calls' ||
          message.type === 'function-call' ||
          message.type === 'tool-call-result'
        ) {
          // Immediately trigger dashboard data refresh!
          onExpenseMutated();
        }
      });

      vapi.on('error', (err: any) => {
        console.error('Vapi error:', err);
        const errMsg = err?.message || err?.errorMsg || 'An error occurred during the voice call.';
        if (errMsg.includes('Permission') || errMsg.includes('NotAllowedError')) {
          setErrorMessage('Microphone permission is required. Please allow microphone access in your browser.');
        } else if (errMsg.includes('401') || errMsg.includes('auth') || errMsg.includes('key')) {
          setErrorMessage('Invalid Vapi Public Key. Please check your credentials in settings.');
        } else {
          setErrorMessage(errMsg);
        }
        setStatus('disconnected');
      });

      vapiRef.current = vapi;
    }
    return vapiRef.current;
  };

  const handleToggleCall = async () => {
    setErrorMessage(null);

    if (status !== 'disconnected') {
      try {
        if (vapiRef.current) {
          vapiRef.current.stop();
        }
      } catch (e) {
        console.error('Error stopping call:', e);
      }
      setStatus('disconnected');
      return;
    }

    const publicKey = vapiConfig.publicKey || (import.meta as any).env.VITE_VAPI_PUBLIC_KEY;
    const assistantId = vapiConfig.assistantId || (import.meta as any).env.VITE_VAPI_ASSISTANT_ID;

    if (!publicKey || !assistantId) {
      setErrorMessage('Vapi Public Key and Assistant ID are required to start voice interaction.');
      onOpenSettings();
      return;
    }

    try {
      setStatus('connecting');
      const vapi = getVapiInstance();
      if (!vapi) {
        setErrorMessage('Failed to initialize Vapi client. Please verify credentials.');
        setStatus('disconnected');
        return;
      }

      await vapi.start(assistantId);
    } catch (err: any) {
      console.error('Failed to start Vapi call:', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        setErrorMessage('Microphone permission is required.');
      } else {
        setErrorMessage(err.message || 'Unable to start voice session. Check your Vapi credentials.');
      }
      setStatus('disconnected');
    }
  };

  const isConnected = status !== 'disconnected';

  const sampleCommands = [
    'Add 450 rupees for dinner',
    'Paid 250 for Uber to office',
    'How much did I spend this month?',
    'Show my latest expenses',
    'Delete my last expense'
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient glow when active */}
      {isConnected && (
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none transition-all duration-700"></div>
      )}

      {/* Header & Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Voice Interaction</h2>
            <StatusIndicator status={status} />
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Tap Start and speak naturally. Vapi handles your voice and updates your expenses in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
            title="Configure Vapi credentials"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            <span>Vapi Settings</span>
          </button>

          {transcripts.length > 0 && (
            <button
              onClick={() => setTranscripts([])}
              type="button"
              className="px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Clear conversation transcript"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mt-4 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl flex items-start gap-3 text-red-200 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
            <button
              onClick={onOpenSettings}
              className="mt-1.5 text-xs font-medium underline text-red-300 hover:text-white"
            >
              Open Settings to verify Public Key & Assistant ID &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Microphone Control Zone */}
      <div className="py-8 flex flex-col items-center justify-center">
        <div className="relative">
          {/* Animated pulse rings when connected */}
          {isConnected && (
            <>
              <div
                className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"
                style={{ animationDuration: '2s' }}
              />
              <div
                className="absolute -inset-3 rounded-full border border-emerald-500/30 transition-all"
                style={{
                  transform: `scale(${1 + Math.min(volumeLevel * 1.5, 0.4)})`,
                  opacity: 0.8
                }}
              />
            </>
          )}

          <button
            onClick={handleToggleCall}
            type="button"
            disabled={status === 'connecting'}
            className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1.5 shadow-2xl transition-all duration-300 cursor-pointer ${
              isConnected
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/50 hover:scale-105 active:scale-95'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 hover:scale-105 active:scale-95'
            } ${status === 'connecting' ? 'opacity-70 cursor-wait' : ''}`}
          >
            {status === 'connecting' ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : isConnected ? (
              <>
                <MicOff className="w-8 h-8" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Stop</span>
              </>
            ) : (
              <>
                <Mic className="w-8 h-8" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Start</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-neutral-200">
            {isConnected
              ? activeSpeechRole === 'user'
                ? 'Listening to you...'
                : activeSpeechRole === 'assistant'
                ? 'VoiceExpense is speaking...'
                : 'Connected — Speak anytime'
              : 'Tap Start to talk with VoiceExpense'}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">
            {isConnected ? 'Press Stop whenever you are finished.' : 'Real-time speech powered by Vapi AI'}
          </p>
        </div>
      </div>

      {/* Live Transcript Stream */}
      <div className="border border-neutral-800 bg-neutral-950/70 rounded-xl p-4 min-h-[160px] max-h-[260px] overflow-y-auto flex flex-col gap-3.5">
        <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2">
          <span>Live Conversation</span>
          <span className="tabular-nums font-mono">{transcripts.length} messages</span>
        </div>

        {transcripts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-neutral-500">
            <Volume2 className="w-6 h-6 mb-2 opacity-40" />
            <p className="text-xs">No speech detected yet.</p>
            <p className="text-[11px] text-neutral-400 mt-1">
              Start the assistant and say something like: "I spent 450 rupees on dinner"
            </p>
          </div>
        ) : (
          transcripts.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col gap-1 text-xs ${
                item.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono">
                <span>{item.role === 'user' ? 'You' : 'VoiceExpense'}</span>
                <span>·</span>
                <span>{item.timestamp}</span>
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  item.role === 'user'
                    ? 'bg-emerald-950/80 text-emerald-100 border border-emerald-800/60 rounded-br-none'
                    : 'bg-neutral-800/90 text-neutral-100 border border-neutral-700/80 rounded-bl-none'
                }`}
              >
                {item.text}
              </div>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Suggested Voice Commands */}
      <div className="mt-4 pt-3 border-t border-neutral-800/70">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Try saying:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sampleCommands.map((cmd, i) => (
            <span
              key={i}
              className="text-xs text-neutral-300 bg-neutral-800/80 border border-neutral-700/60 px-2.5 py-1 rounded-md cursor-default select-all hover:border-neutral-500 transition-colors"
            >
              "{cmd}"
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
