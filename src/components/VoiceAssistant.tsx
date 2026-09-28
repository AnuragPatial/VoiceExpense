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

const SYSTEM_PROMPT = `You are VoiceExpense, a helpful voice-first personal expense tracking assistant.
Your job is to help the user record, query, summarize, and delete their personal expenses.

Always use the provided tools whenever the user asks to add, view, summarize, or delete expenses:
1. addExpense: Call when the user mentions spending money (e.g. "Add 450 rupees for dinner", "I spent 200 on coffee"). Extract amount (number), category (Food, Transport, Shopping, Bills, Entertainment, Health, Travel, Education, Other), description, and expense_date (YYYY-MM-DD, "today", or "yesterday"). If the amount is missing, ask the user how much they spent before calling addExpense.
2. getExpenses: Call when the user asks to see recent expenses or filter expenses by category/date.
3. getExpenseSummary: Call when the user asks how much they spent in total, this month, or on a specific category.
4. deleteExpense: Call when the user asks to delete their last expense (pass id: "last") or a specific expense ID.

Keep your spoken responses concise, natural, and conversational.
After recording an expense, confirm the amount, description, and category (for example: "Done. I recorded ₹450 for dinner under Food.").`;

function getToolDefinitions(serverUrl?: string) {
  const serverBlock = serverUrl ? { server: { url: serverUrl } } : {};

  return [
    {
      type: 'function',
      ...serverBlock,
      function: {
        name: 'addExpense',
        description: 'Record a new personal expense with amount, category, description, and date.',
        parameters: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description: 'The expense amount in rupees (must be greater than 0).'
            },
            category: {
              type: 'string',
              description: 'Expense category: Food, Transport, Shopping, Bills, Entertainment, Health, Travel, Education, or Other.'
            },
            description: {
              type: 'string',
              description: 'Short description of the expense, e.g., Dinner, Uber ride, Coffee.'
            },
            expense_date: {
              type: 'string',
              description: 'Date of the expense (today, yesterday, or YYYY-MM-DD).'
            }
          },
          required: ['amount', 'description']
        }
      }
    },
    {
      type: 'function',
      ...serverBlock,
      function: {
        name: 'getExpenses',
        description: 'Retrieve recent expenses, optionally filtered by category or date range.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Optional category to filter by (Food, Transport, Shopping, Bills, Entertainment, Health, Travel, Education, Other).'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of recent expenses to return (default 5).'
            },
            from: {
              type: 'string',
              description: 'Optional start date (YYYY-MM-DD).'
            },
            to: {
              type: 'string',
              description: 'Optional end date (YYYY-MM-DD).'
            }
          }
        }
      }
    },
    {
      type: 'function',
      ...serverBlock,
      function: {
        name: 'getExpenseSummary',
        description: 'Calculate total spending and category breakdown, optionally filtered by category or date range.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Optional category to summarize.'
            },
            from: {
              type: 'string',
              description: 'Optional start date (YYYY-MM-DD).'
            },
            to: {
              type: 'string',
              description: 'Optional end date (YYYY-MM-DD).'
            }
          }
        }
      }
    },
    {
      type: 'function',
      ...serverBlock,
      function: {
        name: 'deleteExpense',
        description: 'Delete an expense by ID, or pass "last" to delete the most recently added expense.',
        parameters: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the expense to delete, or "last" for the latest expense.'
            }
          },
          required: ['id']
        }
      }
    }
  ];
}

const DEFAULT_PUBLIC_WEBHOOK_URL = 'https://voice-expense-swart.vercel.app/api/vapi/tool';

function getPublicWebhookUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_PUBLIC_WEBHOOK_URL;
  const origin = window.location.origin;
  const isPrivateOrLocal =
    !origin.startsWith('https://') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('.run.app');

  if (!isPrivateOrLocal) {
    return `${origin}/api/vapi/tool`;
  }
  return DEFAULT_PUBLIC_WEBHOOK_URL;
}

function buildInlineAssistant(serverUrl?: string): any {
  const assistant: any = {
    name: 'VoiceExpense Assistant',
    firstMessage: 'Hi! I am VoiceExpense. Tell me what you spent, or ask for your spending summary.',
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en'
    },
    model: {
      provider: 'openai',
      model: 'gpt-5.6-sol',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        }
      ],
      tools: getToolDefinitions(serverUrl)
    },
    clientMessages: [
      'transcript',
      'hang',
      'function-call',
      'speech-update',
      'metadata',
      'conversation-update',
      'status-update',
      'tool-calls',
      'tool-calls-result',
      'tool.completed'
    ]
  };

  if (serverUrl) {
    assistant.server = { url: serverUrl };
  }

  return assistant;
}

function extractVapiErrorMessage(err: any): string {
  if (!err) return 'An unknown error occurred during the voice session.';
  if (typeof err === 'string') return err;

  // Check deeply nested Vapi / Daily / Fetch error structures (only pick strings/arrays, not nested objects)
  const candidates = [
    err?.error?.errorMsg,
    err?.error?.error?.msg,
    err?.error?.error?.message,
    err?.error?.message?.msg,
    err?.error?.message?.message,
    err?.error?.message,
    err?.error?.errorDetail,
    err?.errorMsg,
    err?.message
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.map((c) => (typeof c === 'string' ? c : JSON.stringify(c))).join(', ');
    }
  }

  try {
    return JSON.stringify(err);
  } catch {
    return 'Voice assistant connection error.';
  }
}

function isDailyMeetingEndedEvent(err: any): boolean {
  if (!err) return false;
  const type = err?.error?.error?.type || err?.error?.message?.type || err?.error?.type;
  const msg = extractVapiErrorMessage(err).toLowerCase();
  return (
    type === 'ejected' ||
    msg.includes('meeting has ended') ||
    msg.includes('meeting ended') ||
    msg.includes('call has ended')
  );
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
  const activeKeyRef = useRef<string>('');
  const processedToolCallIdsRef = useRef<Set<string>>(new Set());
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const onExpenseMutatedRef = useRef(onExpenseMutated);
  const callStartTimeRef = useRef<number>(0);
  const hasSpokenRef = useRef<boolean>(false);
  const usingAssistantIdRef = useRef<boolean>(false);
  const fallbackTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    onExpenseMutatedRef.current = onExpenseMutated;
  }, [onExpenseMutated]);

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

  // Forward tool calls from browser client to local/deployed backend (deduplicated by toolCallId)
  const forwardToolCallToBackend = async (messagePayload: any) => {
    try {
      const res = await fetch('/api/vapi/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messagePayload })
      });
      if (res.ok) {
        onExpenseMutatedRef.current();
      }
    } catch (e) {
      console.warn('Client-side tool bridge error:', e);
    }
  };

  const getVapiInstance = (rawPublicKey: string) => {
    const key = rawPublicKey.trim();
    if (!key) return null;

    // Recreate Vapi instance if publicKey changed
    if (vapiRef.current && activeKeyRef.current !== key) {
      try {
        vapiRef.current.stop();
      } catch (e) {
        // ignore
      }
      vapiRef.current = null;
    }

    if (!vapiRef.current) {
      const VapiConstructor =
        typeof Vapi === 'function'
          ? Vapi
          : typeof (Vapi as any)?.default === 'function'
          ? (Vapi as any).default
          : (Vapi as any)?.default?.default;

      if (typeof VapiConstructor !== 'function') {
        throw new Error('Failed to initialize Vapi SDK constructor.');
      }

      const vapi = new VapiConstructor(key);
      activeKeyRef.current = key;

      vapi.on('call-start', () => {
        setStatus('connected');
        setErrorMessage(null);
      });

      vapi.on('call-end', () => {
        if (fallbackTriggeredRef.current && !hasSpokenRef.current && Date.now() - callStartTimeRef.current < 8000) {
          return;
        }
        setStatus('disconnected');
        setActiveSpeechRole(null);
        setVolumeLevel(0);
        onExpenseMutatedRef.current();
      });

      vapi.on('speech-start', () => {
        hasSpokenRef.current = true;
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
        if (!message) return;

        // 1. Handle real-time transcripts
        if (message.type === 'transcript') {
          const role = message.role === 'user' ? 'user' : 'assistant';
          const text = message.transcript || message.text || '';

          if (text.trim()) {
            hasSpokenRef.current = true;
            setActiveSpeechRole(role);
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === role && !last.isFinal && message.transcriptType === 'partial') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
                ];
              }
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

        // 2. Handle tool calls / function calls and ensure backend state is synced
        if (message.type === 'tool-calls' || message.type === 'function-call') {
          const calls =
            message.toolCallList ||
            message.toolCalls ||
            (Array.isArray(message.toolWithToolCallList)
              ? message.toolWithToolCallList.map((t: any) => t.toolCall || t)
              : null) ||
            (message.functionCall ? [message.functionCall] : []);
          let hasNewCall = false;
          for (const c of calls) {
            const id = c?.id || `${c?.name || c?.function?.name}-${JSON.stringify(c?.arguments || c?.parameters || {})}`;
            if (!processedToolCallIdsRef.current.has(id)) {
              processedToolCallIdsRef.current.add(id);
              hasNewCall = true;
            }
          }
          if (hasNewCall) {
            forwardToolCallToBackend(message);
          } else {
            onExpenseMutatedRef.current();
          }
        } else if (
          message.type === 'tool-call-result' ||
          message.type === 'tool-calls-result' ||
          message.type === 'tool.completed'
        ) {
          onExpenseMutatedRef.current();
        }
      });

      vapi.on('error', (err: any) => {
        // Ignore non-critical audio processor warnings from Daily/Krisp
        if (
          err?.type === 'audio-processing-setup-error' ||
          err?.type === 'audio-processor-recovery-error' ||
          err?.type === 'local-audio-level-observer-error'
        ) {
          console.warn('Non-critical Vapi audio processor warning:', err);
          return;
        }

        // Handle Daily "Meeting has ended" / "ejected" event cleanly
        if (isDailyMeetingEndedEvent(err)) {
          const elapsed = Date.now() - callStartTimeRef.current;
          if (usingAssistantIdRef.current && !hasSpokenRef.current && !fallbackTriggeredRef.current && elapsed < 8000) {
            console.warn('Assistant ID session ended before speech; falling back to inline VoiceExpense assistant.');
            fallbackTriggeredRef.current = true;
            usingAssistantIdRef.current = false;
            setStatus('connecting');
            setErrorMessage(null);
            const serverUrl = getPublicWebhookUrl();
            setTimeout(async () => {
              try {
                try {
                  await vapi.stop();
                } catch {}
                callStartTimeRef.current = Date.now();
                const res = await vapi.start(buildInlineAssistant(serverUrl));
                if (!res) {
                  setStatus('disconnected');
                }
              } catch (fallbackErr) {
                console.error('Fallback inline assistant failed:', fallbackErr);
                setErrorMessage(extractVapiErrorMessage(fallbackErr));
                setStatus('disconnected');
              }
            }, 300);
            return;
          }

          // Normal end of meeting from Vapi server
          setStatus('disconnected');
          setActiveSpeechRole(null);
          setVolumeLevel(0);
          onExpenseMutatedRef.current();
          return;
        }

        console.error('Vapi error:', err);
        const errMsg = extractVapiErrorMessage(err);

        if (/permission|notallowederror|microphone|device/i.test(errMsg)) {
          setErrorMessage('Microphone permission is required. Please allow microphone access in your browser settings.');
        } else if (/401|unauthorized|public key|invalid key|authentication/i.test(errMsg)) {
          setErrorMessage('Invalid Vapi Public Key. Please verify your Public Key in Vapi Settings.');
        } else if (/assistantId|assistant.*not found|404/i.test(errMsg)) {
          setErrorMessage('Assistant ID not found in your Vapi account. Tip: Clear the Assistant ID in Vapi Settings to use the built-in auto-configured VoiceExpense assistant.');
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
      fallbackTriggeredRef.current = false;
      usingAssistantIdRef.current = false;
      try {
        if (vapiRef.current) {
          await vapiRef.current.stop();
        }
      } catch (e) {
        console.error('Error stopping call:', e);
      }
      setStatus('disconnected');
      return;
    }

    const publicKey = (vapiConfig.publicKey || (import.meta as any).env.VITE_VAPI_PUBLIC_KEY || '').trim();
    const assistantId = (vapiConfig.assistantId || (import.meta as any).env.VITE_VAPI_ASSISTANT_ID || '').trim();

    if (!publicKey) {
      setErrorMessage('Vapi Public Key is required to start voice interaction. Click "Vapi Settings" to enter your key.');
      onOpenSettings();
      return;
    }

    try {
      setStatus('connecting');
      callStartTimeRef.current = Date.now();
      hasSpokenRef.current = false;
      fallbackTriggeredRef.current = false;
      usingAssistantIdRef.current = Boolean(assistantId);

      // Request microphone permission upfront to give a clear error if blocked
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch (micErr: any) {
          setErrorMessage('Microphone access was denied. Please allow microphone access in your browser address bar and try again.');
          setStatus('disconnected');
          return;
        }
      }

      const vapi = getVapiInstance(publicKey);
      if (!vapi) {
        setErrorMessage('Failed to initialize Vapi client. Please check your Public Key.');
        setStatus('disconnected');
        return;
      }

      const serverUrl = getPublicWebhookUrl();
      let callResult = null;

      if (assistantId) {
        // Override model tools and server URL using standard Vapi AssistantOverrides schema
        const overrides: any = {
          model: {
            provider: 'openai',
            model: 'gpt-5.6-sol',
            messages: [
              {
                role: 'system',
                content: SYSTEM_PROMPT
              }
            ],
            tools: getToolDefinitions(serverUrl)
          },
          clientMessages: [
            'transcript',
            'hang',
            'function-call',
            'speech-update',
            'metadata',
            'conversation-update',
            'status-update',
            'tool-calls',
            'tool-calls-result',
            'tool.completed'
          ]
        };
        if (serverUrl) {
          overrides.server = { url: serverUrl };
        }

        try {
          callResult = await vapi.start(assistantId, overrides);
        } catch (assistantErr) {
          console.warn('Starting with assistantId failed; falling back to inline assistant:', assistantErr);
          callResult = null;
        }

        // If starting with assistantId failed immediately, fallback to inline assistant config
        if (!callResult) {
          usingAssistantIdRef.current = false;
          try {
            await vapi.stop();
          } catch {}
          setStatus('connecting');
          setErrorMessage(null);
          callStartTimeRef.current = Date.now();
          callResult = await vapi.start(buildInlineAssistant(serverUrl));
        }
      } else {
        // Start with built-in auto-configured VoiceExpense assistant
        callResult = await vapi.start(buildInlineAssistant(serverUrl));
      }

      if (!callResult) {
        setStatus('disconnected');
      }
    } catch (err: any) {
      console.error('Failed to start Vapi call:', err);
      const msg = extractVapiErrorMessage(err);
      if (/permission|notallowederror/i.test(msg)) {
        setErrorMessage('Microphone permission is required.');
      } else {
        setErrorMessage(msg || 'Unable to start voice session. Check your Vapi Public Key.');
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
              className="mt-1.5 text-xs font-medium underline text-red-300 hover:text-white cursor-pointer"
            >
              Open Vapi Settings to check Public Key &amp; Assistant ID &rarr;
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
